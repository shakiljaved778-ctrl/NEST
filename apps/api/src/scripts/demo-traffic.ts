/**
 * Synthetic console traffic (demo only): runs pre-action checks for the demo personas through the
 * real pipeline (consent, packs, approved copy, gateway, audit) at times spread over the past
 * days, and records plausible customer responses, so the console dashboard has data to show.
 *   pnpm --filter @amil/api demo:traffic            # 30 days, about 12 checks a day
 *   pnpm --filter @amil/api demo:traffic 14 20      # 14 days, about 20 a day
 * Every event goes into the same hash-chained audit log as live traffic. Demo data only.
 */
import { demoContexts, getPrisma, loadCustomerBundle, type PackContext } from "@amil/db";
import type { CheckRequest } from "@amil/sdk";
import { CheckAction } from "@amil/sdk";
import { Redis } from "ioredis";
import pino from "pino";
import { loadConfig } from "../config";
import { buildModelGateway } from "../model-gateway";
import { runCheck } from "../services/checks";

const [daysArg, perDayArg] = process.argv.slice(2);
const days = Number(daysArg ?? 30);
const perDay = Number(perDayArg ?? 12);

/** Deterministic, so two runs on a fresh seed show the same dashboard. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(20261001);
const pick = <T>(xs: T[]): T => xs[Math.floor(random() * xs.length)] as T;

const config = loadConfig();
const prisma = getPrisma();
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 });
const { gateway } = buildModelGateway(config, redis);
const log = pino({ level: "warn" });

const bank = await prisma.bank.findFirstOrThrow({ where: { id: "bank_ddb" } });
const customers = await prisma.customer.findMany({
  where: {
    bankId: bank.id,
    personaKey: { not: null },
    consents: { some: { purpose: "pre_decision_insights", withdrawnAt: null } },
  },
  select: { id: true, externalRef: true },
});
const candidates: { customerRef: string; action: CheckRequest["action"]; context: PackContext }[] =
  [];
for (const c of customers) {
  const bundle = await loadCustomerBundle(prisma, c.id);
  if (!bundle) continue;
  for (const action of CheckAction.options)
    for (const context of demoContexts(action, bundle))
      candidates.push({ customerRef: c.externalRef, action, context });
}

const end = Date.now();
let shown = 0;
let checks = 0;
for (let d = days; d >= 1; d--) {
  const n = Math.max(1, Math.round(perDay * (0.6 + random() * 0.8)));
  for (let i = 0; i < n; i++) {
    const c = pick(candidates);
    const at = new Date(end - d * 86_400_000 + Math.floor(random() * 12 + 7) * 3_600_000);
    const deps = {
      prisma,
      gateway,
      auditHashSecret: config.AUDIT_HASH_SECRET,
      clock: () => at,
      log,
    };
    try {
      const res = await runCheck(deps, bank.id, {
        customerRef: c.customerRef,
        action: c.action,
        context: c.context,
        locale: random() < 0.45 ? "ar" : "en",
      });
      checks++;
      if (res.kind !== "insight" || !res.card) continue;
      shown++;
      // Most customers answer; of those, a share reconsider (choose the first, loss-avoiding option).
      const r = random();
      if (r < 0.15) continue;
      const first = res.card.options[0]?.key;
      const response =
        r < 0.55
          ? { action: "continued" as const }
          : r < 0.85 && first
            ? { action: "chose_option" as const, optionKey: first }
            : r < 0.93
              ? { action: "talk_to_someone" as const }
              : { action: "dismissed" as const };
      await prisma.customerResponse.create({
        data: {
          insightEventId: res.insightId,
          action: response.action,
          optionKey: "optionKey" in response ? response.optionKey : null,
          at: new Date(at.getTime() + 60_000),
        },
      });
    } catch {
      // A product the persona does not hold on that day: skip, as the bank app would not ask.
    }
  }
}
await gateway.drain();
console.log(`${checks} checks over ${days} days, ${shown} insights shown`);
await prisma.$disconnect();
redis.disconnect();
