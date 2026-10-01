import {
  D,
  type Evaluation,
  FactBuilder,
  isoDate,
  max,
  min,
  percentOf,
  round,
  type SeverityThresholds,
  severityForAmount,
  toFixedString,
  toMoneyString,
} from "@amil/rules-engine";
import { z } from "zod";
import { RoundingModeSchema } from "../define";
import { amortiseRevolving } from "../shared/finance-math";

const decimal = z.string().regex(/^\d+(\.\d+)?$/);

export const BalanceTransferParamsSchema = z.object({
  feePct: decimal,
  feeMin: decimal,
  promoRatePct: decimal,
  promoMonths: z.number().int().min(0).max(36),
  /** Rate charged once the promo ends. */
  revertRatePct: decimal,
  /** Assumed monthly payment: the minimum-due formula. */
  minDuePct: decimal,
  minDueFloor: decimal,
  roundingMode: RoundingModeSchema,
});
export type BalanceTransferParams = z.infer<typeof BalanceTransferParamsSchema>;

export interface BalanceTransferInput {
  dataAsOf: Date;
  card: { id: string; variant: "conventional" | "islamic"; aprPct: string };
  amount: string;
}

export const BALANCE_TRANSFER_FACT_KEYS = [
  "transferAmount",
  "transferFee",
  "transferFeePct",
  "promoMonths",
  "promoRatePct",
  "revertRatePct",
  "remainingAfterPromo",
  "chargeYearAfterPromo",
  "costPromoAndYearAfter",
] as const;
export type BalanceTransferFactKey = (typeof BALANCE_TRANSFER_FACT_KEYS)[number];

/**
 * card.balance_transfer: the transfer fee, the promotional period and rate, and, if only the
 * minimum is paid, what remains when the promo ends and what the following 12 months cost at the
 * revert rate.
 *
 * Worked example: 2,000.00, fee 2% min 50 = 50.00; promo 0% for 2 months; minimum max(5%, 100):
 *   promo: pay 100 + 100 -> 1,800.00 remaining
 *   then 12 months at 24% paying max(5%, 100): 314.80 in charges; cost 50.00 + 314.80 = 364.80
 */
export function evaluateBalanceTransfer(
  input: BalanceTransferInput,
  params: BalanceTransferParams,
  thresholds: SeverityThresholds,
): Evaluation<BalanceTransferFactKey> {
  const mode = params.roundingMode;
  const asOf = isoDate(input.dataAsOf);
  const amount = D(input.amount);
  const fee = max(round(percentOf(amount, D(params.feePct)), mode), D(params.feeMin));
  const revert = D(params.revertRatePct);
  const minimumOf = (b: ReturnType<typeof D>) =>
    min(max(round(percentOf(b, D(params.minDuePct)), mode), D(params.minDueFloor)), b);

  const promo = amortiseRevolving(amount, {
    payment: minimumOf,
    aprPct: D(params.promoRatePct),
    maxMonths: params.promoMonths,
    mode,
  });
  const remaining = amount.minus(promo.totalPaid).plus(promo.totalInterest);
  const after = amortiseRevolving(remaining, {
    payment: minimumOf,
    aprPct: revert,
    maxMonths: 12,
    mode,
  });
  const cost = fee.plus(promo.totalInterest).plus(after.totalInterest);

  const f = new FactBuilder<BalanceTransferFactKey>()
    .add("transferAmount", toMoneyString(amount), "QAR", "computed", asOf)
    .add("transferFee", toMoneyString(fee), "QAR", "rule_pack", asOf)
    .add("transferFeePct", toFixedString(D(params.feePct), 2), "percent", "rule_pack", asOf)
    .add("promoMonths", String(params.promoMonths), "months", "rule_pack", asOf)
    .add("promoRatePct", toFixedString(D(params.promoRatePct), 2), "percent", "rule_pack", asOf)
    .add("revertRatePct", toFixedString(revert, 2), "percent", "rule_pack", asOf)
    .add("remainingAfterPromo", toMoneyString(remaining), "QAR", "computed", asOf)
    .add("chargeYearAfterPromo", toMoneyString(after.totalInterest), "QAR", "computed", asOf)
    .add("costPromoAndYearAfter", toMoneyString(cost), "QAR", "computed", asOf);

  const severity = severityForAmount(cost, thresholds);
  return {
    applicable: amount.greaterThan(0),
    severity,
    facts: f.build(),
    options: ["adjust_transfer_amount", "continue_balance_transfer", "talk_to_someone"],
    explanation: [
      "balance_transfer_fee_applies",
      "promo_rate_ends",
      `severity_basis_qar:${toMoneyString(cost)}`,
      `severity:${severity}`,
    ],
  };
}
