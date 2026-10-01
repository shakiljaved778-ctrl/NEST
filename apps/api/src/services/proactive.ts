import { randomUUID } from "node:crypto";
import {
  alertDedupeKey,
  hashCustomerRef,
  loadCustomerBundle,
  proactiveContexts,
  resolvePackInput,
} from "@amil/db";
import type { AnyEvaluation } from "@amil/rules-engine";
import { type CheckDeps, deliverInsight, makeAudit } from "./checks";

export const PROACTIVE_PACKS = ["account.dormancy", "rewards.expiry"] as const;
export type ProactivePack = (typeof PROACTIVE_PACKS)[number];

export interface ProactiveRunResult {
  packKey: ProactivePack;
  status: "ran" | "job_disabled" | "no_bank";
  customers: number;
  evaluated: number;
  alertsCreated: number;
  alreadyAlerted: number;
}

/**
 * One scheduled run of a proactive pack for a bank (the BullMQ worker and the CLI both call this).
 * Only customers who consented to proactive alerts are read (non-negotiable 5). Each product is
 * evaluated through the same pipeline as a check (kill switch, approved copy, gateway, audit);
 * an applicable result becomes an audited insight plus one Alert row. The dedupe key (product +
 * event date) means re-running never alerts a customer twice about the same expiry or dormancy
 * date, and a duplicate is not audited again. Non-applicable products are not audited: nothing was
 * shown to anyone.
 */
export async function runProactive(
  deps: CheckDeps,
  bankId: string,
  packKey: ProactivePack,
): Promise<ProactiveRunResult> {
  const now = deps.clock();
  const result: ProactiveRunResult = {
    packKey,
    status: "ran",
    customers: 0,
    evaluated: 0,
    alertsCreated: 0,
    alreadyAlerted: 0,
  };
  const bank = await deps.prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) return { ...result, status: "no_bank" };
  const job = await deps.prisma.proactiveJob.findUnique({
    where: { bankId_rulePackKey: { bankId, rulePackKey: packKey } },
  });
  if (job && !job.enabled) return { ...result, status: "job_disabled" };

  const customers = await deps.prisma.customer.findMany({
    where: {
      bankId,
      consents: { some: { purpose: "proactive_alerts", withdrawnAt: null } },
    },
    select: { id: true, externalRef: true, preferredLocale: true },
    orderBy: { id: "asc" },
  });
  result.customers = customers.length;

  for (const customer of customers) {
    const bundle = await loadCustomerBundle(deps.prisma, customer.id);
    if (!bundle) continue;
    for (const context of proactiveContexts(packKey, bundle)) {
      const resolved = resolvePackInput(packKey, bundle, context, now);
      if (!resolved) continue;
      result.evaluated++;
      let dedupeKey = "";
      const customerRefHash = hashCustomerRef(deps.auditHashSecret, bankId, customer.externalRef);
      // Word the alert in every language the bank supports (preferred first), so the inbox
      // shows it in whichever language the customer reads. Each wording is audited.
      const locales = [
        customer.preferredLocale,
        ...bank.supportedLocales.filter((l) => l !== customer.preferredLocale),
      ];
      const eventIds: Record<string, string> = {};
      let severity: AnyEvaluation["severity"] | null = null;
      for (const [index, locale] of locales.entries()) {
        const insightId = randomUUID();
        const audit = makeAudit(deps, bank, {
          id: insightId,
          trigger: `schedule:${packKey}`,
          customerRefHash,
          rulePackKey: packKey,
          locale,
          now,
        });
        const delivered = await deliverInsight(
          deps,
          bank,
          now,
          locale,
          insightId,
          audit,
          { packKey, variant: resolved.variant, input: resolved.input, context },
          index > 0
            ? undefined
            : async (evaluation) => {
                if (!evaluation.applicable) return false;
                dedupeKey = alertDedupeKey(packKey, context, evaluation);
                const existing = await deps.prisma.alert.findUnique({
                  where: { customerId_dedupeKey: { customerId: customer.id, dedupeKey } },
                  select: { id: true },
                });
                if (existing) result.alreadyAlerted++;
                return !existing;
              },
        );
        if (!delivered.auditEventId || !delivered.evaluation) break;
        eventIds[locale] = delivered.auditEventId;
        severity ??= delivered.evaluation.severity;
      }
      const preferred = eventIds[customer.preferredLocale];
      if (!preferred || !severity) continue;
      await deps.prisma.alert.create({
        data: {
          customerId: customer.id,
          insightEventId: preferred,
          localeEventIds: eventIds,
          rulePackKey: packKey,
          severity,
          dedupeKey,
          createdAt: now,
        },
      });
      result.alertsCreated++;
    }
  }

  await deps.prisma.proactiveJob.updateMany({
    where: { bankId, rulePackKey: packKey },
    data: { lastRunAt: now },
  });
  deps.log.info(result, "proactive_run");
  return result;
}
