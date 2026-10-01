import { randomUUID } from "node:crypto";
import { hashCustomerRef } from "@amil/db";
import { formatMoney, formatPercent, messages } from "@amil/i18n";
import { D, isoDate, max, percentOf, round, toMoneyString } from "@amil/rules-engine";
import type { ChargeCalculation, ChargeExplanation, ExplainChargeRequest } from "@amil/sdk";
import { z } from "zod";
import { notFound } from "../errors";
import { type CheckDeps, type Locale, makeAudit } from "./checks";

const AmountRule = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fixed"), amount: z.string() }),
  z.object({ type: z.literal("pct"), pct: z.string(), min: z.string().optional() }),
  z.object({ type: z.literal("per_product") }),
  z.object({ type: z.literal("rate_on_balance") }),
]);

/**
 * Which transactions a percentage fee can be charged on. A minimum fee makes many small amounts
 * "produce" the same charge, so matching on the amount alone would point at the wrong line.
 */
const BASE_TYPES: Record<string, TxnType[]> = {
  CARD_CASH_ADVANCE: ["cash_withdrawal"],
  CARD_FX: ["purchase"],
  CARD_EPP_PROCESSING: ["purchase", "instalment"],
  CARD_BALANCE_TRANSFER: ["transfer_in", "transfer_out", "payment"],
};
type TxnType =
  "purchase" | "cash_withdrawal" | "instalment" | "transfer_in" | "transfer_out" | "payment";

/**
 * POST /v1/explain-charge: why a fee line on the customer's statement is what it is.
 *
 * Template-only, never generated (non-negotiable 1): the name, description and how-to-avoid
 * text come from the bank's published fee schedule (the version in force when the fee posted),
 * and the calculation is recomputed from the customer's own transactions. A percentage fee is
 * matched to the transaction it was charged on (same card or account, same day); `matches`
 * says whether the charge equals the published rule. Consent first (non-negotiable 5): without it
 * only general information is returned and no transaction is read. Every explanation is audited.
 */
export async function explainCharge(
  deps: CheckDeps,
  bankId: string,
  req: ExplainChargeRequest,
  sessionLocale?: Locale,
): Promise<ChargeExplanation> {
  const now = deps.clock();
  const bank = await deps.prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) throw notFound();
  const customer = await deps.prisma.customer.findUnique({
    where: { bankId_externalRef: { bankId, externalRef: req.customerRef } },
    select: { id: true, preferredLocale: true },
  });
  if (!customer) throw notFound();
  const locale: Locale = req.locale ?? sessionLocale ?? customer.preferredLocale;
  const m = messages[locale].charge;
  const display = { locale, digitStyle: bank.digitStyle };
  const explanationId = randomUUID();
  const audit = makeAudit(deps, bank, {
    id: explanationId,
    trigger: "action:explain.charge",
    customerRefHash: hashCustomerRef(deps.auditHashSecret, bankId, req.customerRef),
    rulePackKey: "explain.charge",
    locale,
    now,
  });
  const empty = {
    explanationId,
    feeCode: null,
    name: null,
    description: null,
    amount: null,
    postedAt: null,
    calculation: null,
    avoidTip: null,
  };
  const record = async (
    result: ChargeExplanation,
    extra: {
      version: string;
      variant: "conventional" | "islamic";
      facts: object;
      applicable: boolean;
    },
  ) => {
    await audit({
      rulePackVersion: extra.version,
      variant: extra.variant,
      inputSnapshotHash: "",
      applicable: extra.applicable,
      severity: extra.applicable ? "info" : null,
      facts: extra.facts,
      templateKey: result.feeCode ? `fee_schedule.${result.feeCode}` : null,
      templateVersion: null,
      modelProvider: null,
      modelVersion: null,
      validatorResult: "not_used",
      shown: result,
    });
    return result;
  };

  const consent = await deps.prisma.consent.findFirst({
    where: { customerId: customer.id, purpose: "pre_decision_insights", withdrawnAt: null },
    select: { id: true },
  });
  if (!consent)
    return record(
      { ...empty, kind: "generic", disclosure: m.generic },
      { version: "n/a", variant: "conventional", facts: {}, applicable: true },
    );

  const txn = await deps.prisma.transaction.findFirst({
    where: {
      id: req.transactionId,
      OR: [{ card: { customerId: customer.id } }, { account: { customerId: customer.id } }],
    },
    include: { card: true, account: true },
  });
  if (!txn) throw notFound();
  const variant = txn.card?.type ?? txn.account?.variant ?? "conventional";
  if (!txn.feeCode)
    return record(
      { ...empty, kind: "none", disclosure: m.notAFee },
      { version: "n/a", variant, facts: {}, applicable: false },
    );

  const fee =
    (await deps.prisma.feeSchedule.findFirst({
      where: { bankId, code: txn.feeCode, effectiveFrom: { lte: txn.postedAt } },
      orderBy: { version: "desc" },
    })) ??
    (await deps.prisma.feeSchedule.findFirst({
      where: { bankId, code: txn.feeCode },
      orderBy: { version: "asc" },
    }));
  if (!fee) throw notFound();

  const charged = D(txn.amount.toString());
  const money = (v: ReturnType<typeof D>) => formatMoney(toMoneyString(v), display);
  const rule = AmountRule.parse(fee.amountRule);
  let calculation: ChargeCalculation;
  const facts: Record<string, string> = { charged: toMoneyString(charged) };
  switch (rule.type) {
    case "fixed":
      calculation = {
        kind: "fixed",
        lines: [{ label: m.fixed, display: money(D(rule.amount)) }],
        matches: charged.equals(D(rule.amount)),
      };
      break;
    case "pct": {
      const feeFor = (base: ReturnType<typeof D>) => {
        const pct = round(percentOf(base, D(rule.pct)));
        return rule.min ? max(pct, D(rule.min)) : pct;
      };
      const dayStart = new Date(`${isoDate(txn.postedAt)}T00:00:00.000Z`);
      const candidates = await deps.prisma.transaction.findMany({
        where: {
          id: { not: txn.id },
          ...(txn.cardId ? { cardId: txn.cardId } : { accountId: txn.accountId }),
          direction: "debit",
          ...(BASE_TYPES[fee.code]
            ? { type: { in: BASE_TYPES[fee.code] } }
            : { type: { not: "fee" } }),
          postedAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) },
        },
        orderBy: { postedAt: "asc" },
      });
      const base = candidates.find((c) => feeFor(D(c.amount.toString())).equals(charged));
      const lines = [
        ...(base
          ? [
              {
                label: m.base,
                display: `${base.merchant ?? ""} · ${money(D(base.amount.toString()))}`,
              },
            ]
          : []),
        { label: m.rate, display: formatPercent(rule.pct, display) },
        ...(rule.min ? [{ label: m.minimum, display: money(D(rule.min)) }] : []),
        ...(base ? [{ label: m.computed, display: money(feeFor(D(base.amount.toString()))) }] : []),
      ];
      if (base) facts.baseAmount = toMoneyString(D(base.amount.toString()));
      calculation = { kind: "percentage", lines, matches: base ? true : null };
      break;
    }
    case "rate_on_balance": {
      const apr = txn.card ? D(txn.card.profitOrInterestRateApr.toString()) : null;
      calculation = {
        kind: "rate_on_balance",
        lines: apr
          ? [
              { label: m.annualRate, display: formatPercent(apr.toFixed(2), display) },
              {
                label: m.monthlyRate,
                display: formatPercent(apr.dividedBy(12).toFixed(2), display),
              },
            ]
          : [],
        matches: null,
      };
      break;
    }
    case "per_product": {
      const productFee = txn.card ? D(txn.card.annualFee.toString()) : null;
      calculation = {
        kind: "per_product",
        lines: productFee ? [{ label: m.productFee, display: money(productFee) }] : [],
        matches: productFee ? charged.equals(productFee) : null,
      };
      break;
    }
  }

  const postedAt = isoDate(txn.postedAt);
  const result: ChargeExplanation = {
    explanationId,
    kind: "charge",
    feeCode: fee.code,
    name: locale === "ar" ? fee.nameAr : fee.nameEn,
    description: locale === "ar" ? fee.descriptionAr : fee.descriptionEn,
    amount: {
      key: "charged",
      label: m.charged,
      value: toMoneyString(charged),
      display: money(charged),
      unit: "QAR",
      source: "transaction",
      asOf: postedAt,
    },
    postedAt,
    calculation,
    avoidTip: locale === "ar" ? fee.avoidTipAr : fee.avoidTipEn,
    disclosure: m.disclosure
      .replace("{bankName}", locale === "ar" ? bank.nameAr : bank.name)
      .replace("{version}", String(fee.version)),
  };
  return record(result, {
    version: `fee_schedule@${fee.version}`,
    variant,
    facts: { ...facts, feeCode: fee.code, matches: String(calculation.matches) },
    applicable: true,
  });
}
