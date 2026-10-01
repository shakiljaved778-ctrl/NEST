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

export const MinimumPaymentParamsSchema = z.object({
  /** Minimum-due formula: max(pct × balance, floor), never above the balance. */
  minDuePct: decimal,
  minDueFloor: decimal,
  /** Default comparison when the customer has not chosen an amount: minimum due × this. */
  comparisonMultiple: decimal,
  maxMonths: z.number().int().min(12).max(1200),
  roundingMode: RoundingModeSchema,
});
export type MinimumPaymentParams = z.infer<typeof MinimumPaymentParamsSchema>;

export interface MinimumPaymentInput {
  dataAsOf: Date;
  card: {
    id: string;
    variant: "conventional" | "islamic";
    statementBalance: string;
    minDue: string;
    aprPct: string;
  };
  /** A higher monthly amount the customer is considering (the compare slider). */
  comparisonPayment?: string;
}

export const MINIMUM_PAYMENT_FACT_KEYS = [
  "statementBalance",
  "minimumDue",
  "aprPct",
  "monthsToClearMinimum",
  "totalInterestMinimum",
  "totalPaidMinimum",
  "minimumClearsBalance",
  "comparisonPayment",
  "monthsToClearComparison",
  "totalInterestComparison",
  "interestSavedComparison",
  "monthsSavedComparison",
] as const;
export type MinimumPaymentFactKey = (typeof MINIMUM_PAYMENT_FACT_KEYS)[number];

/**
 * card.minimum_payment: how long the statement balance takes to clear when paying only the
 * minimum each month (the bank's minimum-due formula, re-applied to the falling balance), the
 * total interest/profit, and the saving from paying a fixed higher amount instead.
 *
 * Worked example: 1,000.00 at 24% (2% a month), minimum max(5%, 100), comparison 500:
 *   minimum: pays 100 a month (5% < 100) -> clears in 12 months, interest 102.16
 *   500/month: m1 500 -> 510.00; m2 500 -> 10.20; m3 10.20 -> clears in 3 months, interest 10.20
 *   saving 91.96 and 9 months
 */
export function evaluateMinimumPayment(
  input: MinimumPaymentInput,
  params: MinimumPaymentParams,
  thresholds: SeverityThresholds,
): Evaluation<MinimumPaymentFactKey> {
  const mode = params.roundingMode;
  const asOf = isoDate(input.dataAsOf);
  const balance = D(input.card.statementBalance);
  const apr = D(input.card.aprPct);
  const minimumOf = (b: ReturnType<typeof D>) =>
    min(max(round(percentOf(b, D(params.minDuePct)), mode), D(params.minDueFloor)), b);
  const minimumDue = minimumOf(balance);
  const comparison = input.comparisonPayment
    ? D(input.comparisonPayment)
    : round(minimumDue.times(D(params.comparisonMultiple)), mode);

  const minPlan = amortiseRevolving(balance, {
    payment: minimumOf,
    aprPct: apr,
    maxMonths: params.maxMonths,
    mode,
  });
  const cmpPlan = amortiseRevolving(balance, {
    payment: () => comparison,
    aprPct: apr,
    maxMonths: params.maxMonths,
    mode,
  });

  const f = new FactBuilder<MinimumPaymentFactKey>()
    .add("statementBalance", toMoneyString(balance), "QAR", "card", asOf)
    .add("minimumDue", toMoneyString(minimumDue), "QAR", "computed", asOf)
    .add("aprPct", toFixedString(apr, 2), "percent", "card", asOf)
    .add("monthsToClearMinimum", String(minPlan.months), "months", "computed", asOf)
    .add("totalInterestMinimum", toMoneyString(minPlan.totalInterest), "QAR", "computed", asOf)
    .add("totalPaidMinimum", toMoneyString(minPlan.totalPaid), "QAR", "computed", asOf)
    .add("minimumClearsBalance", String(minPlan.clears), "boolean", "computed", asOf)
    .add("comparisonPayment", toMoneyString(comparison), "QAR", "computed", asOf)
    .add("monthsToClearComparison", String(cmpPlan.months), "months", "computed", asOf)
    .add("totalInterestComparison", toMoneyString(cmpPlan.totalInterest), "QAR", "computed", asOf)
    .add(
      "interestSavedComparison",
      toMoneyString(max(minPlan.totalInterest.minus(cmpPlan.totalInterest), D(0))),
      "QAR",
      "computed",
      asOf,
    )
    .add(
      "monthsSavedComparison",
      String(Math.max(minPlan.months - cmpPlan.months, 0)),
      "months",
      "computed",
      asOf,
    );

  const severity = severityForAmount(minPlan.totalInterest, thresholds);
  const explanation = [
    "minimum_payment_extends_repayment",
    `severity_basis_qar:${toMoneyString(minPlan.totalInterest)}`,
    `severity:${severity}`,
  ];
  if (!minPlan.clears) explanation.unshift("minimum_payment_does_not_clear_balance");
  return {
    applicable: balance.greaterThan(minimumDue),
    severity,
    facts: f.build(),
    options: [
      "pay_statement_balance",
      "pay_custom_amount",
      "continue_minimum_payment",
      "talk_to_someone",
    ],
    explanation,
  };
}
