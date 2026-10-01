import {
  D,
  type Evaluation,
  FactBuilder,
  isoDate,
  max,
  percentOf,
  round,
  type SeverityThresholds,
  severityForAmount,
  toFixedString,
  toMoneyString,
} from "@amil/rules-engine";
import { z } from "zod";
import { RoundingModeSchema } from "../define";

export const CashWithdrawalParamsSchema = z.object({
  /** Repayment horizons shown to the customer (days). */
  shortHorizonDays: z.number().int().min(1).max(365),
  longHorizonDays: z.number().int().min(1).max(365),
  dayCountBasis: z.union([z.literal(360), z.literal(365)]),
  roundingMode: RoundingModeSchema,
});
export type CashWithdrawalParams = z.infer<typeof CashWithdrawalParamsSchema>;

export interface CashWithdrawalInput {
  dataAsOf: Date;
  card: {
    id: string;
    variant: "conventional" | "islamic";
    balance: string;
    creditLimit: string;
    aprPct: string;
    cashAdvanceFeePct: string;
    cashAdvanceMinFee: string;
  };
  amount: string;
}

export const CASH_WITHDRAWAL_FACT_KEYS = [
  "withdrawalAmount",
  "cashFee",
  "cashFeePct",
  "cashFeeMin",
  "aprPct",
  "shortHorizonDays",
  "costIfRepaidShort",
  "longHorizonDays",
  "costIfRepaidLong",
  "availableCredit",
  "exceedsAvailableCredit",
] as const;
export type CashWithdrawalFactKey = (typeof CASH_WITHDRAWAL_FACT_KEYS)[number];

/**
 * card.cash_withdrawal: the fee (percentage with a minimum) and the interest/profit that accrues
 * from the day of withdrawal.
 *
 * Worked example (Ravi, 1,000.00 at 30% APR, fee 3% min 60, 365-day basis):
 *   fee = max(30.00, 60.00) = 60.00
 *   30 days: 60.00 + 1,000 × 30% × 30/365 (24.66) = 84.66
 *   60 days: 60.00 + 1,000 × 30% × 60/365 (49.32) = 109.32
 */
export function evaluateCashWithdrawal(
  input: CashWithdrawalInput,
  params: CashWithdrawalParams,
  thresholds: SeverityThresholds,
): Evaluation<CashWithdrawalFactKey> {
  const mode = params.roundingMode;
  const asOf = isoDate(input.dataAsOf);
  const amount = D(input.amount);
  const apr = D(input.card.aprPct);
  const fee = max(
    round(percentOf(amount, D(input.card.cashAdvanceFeePct)), mode),
    D(input.card.cashAdvanceMinFee),
  );
  const accrued = (days: number) =>
    round(amount.times(apr).dividedBy(100).times(days).dividedBy(params.dayCountBasis), mode);
  const costShort = fee.plus(accrued(params.shortHorizonDays));
  const costLong = fee.plus(accrued(params.longHorizonDays));
  const available = max(D(input.card.creditLimit).minus(D(input.card.balance)), D(0));
  const exceeds = amount.greaterThan(available);

  const f = new FactBuilder<CashWithdrawalFactKey>()
    .add("withdrawalAmount", toMoneyString(amount), "QAR", "computed", asOf)
    .add("cashFee", toMoneyString(fee), "QAR", "computed", asOf)
    .add("cashFeePct", toFixedString(D(input.card.cashAdvanceFeePct), 2), "percent", "card", asOf)
    .add("cashFeeMin", toMoneyString(D(input.card.cashAdvanceMinFee)), "QAR", "card", asOf)
    .add("aprPct", toFixedString(apr, 2), "percent", "card", asOf)
    .add("shortHorizonDays", String(params.shortHorizonDays), "days", "rule_pack", asOf)
    .add("costIfRepaidShort", toMoneyString(costShort), "QAR", "computed", asOf)
    .add("longHorizonDays", String(params.longHorizonDays), "days", "rule_pack", asOf)
    .add("costIfRepaidLong", toMoneyString(costLong), "QAR", "computed", asOf)
    .add("availableCredit", toMoneyString(available), "QAR", "card", asOf)
    .add("exceedsAvailableCredit", String(exceeds), "boolean", "computed", asOf);

  const severity = severityForAmount(costShort, thresholds);
  const explanation = [
    "cash_withdrawal_fee_applies",
    "charges_accrue_from_withdrawal_day",
    `severity_basis_qar:${toMoneyString(costShort)}`,
    `severity:${severity}`,
  ];
  if (exceeds) explanation.unshift("withdrawal_exceeds_available_credit");
  return {
    applicable: amount.greaterThan(0),
    severity,
    facts: f.build(),
    options: ["use_debit_card", "continue_withdrawal", "talk_to_someone"],
    explanation,
  };
}
