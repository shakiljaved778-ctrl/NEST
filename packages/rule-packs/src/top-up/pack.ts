import {
  clamp,
  D,
  type Dec,
  type Evaluation,
  FactBuilder,
  isoDate,
  max,
  percentOf,
  round,
  type SeverityThresholds,
  severityForAmount,
  startOfUtcDay,
  sum,
  toMoneyString,
} from "@amil/rules-engine";
import { z } from "zod";
import { RoundingModeSchema } from "../define";
import { quoteSettlement } from "../finance-early-settlement/calculate";
import type { FinanceSettlementInput } from "../finance-early-settlement/types";
import { annuityInstalment, flatInstalment } from "../shared/finance-math";

const decimal = z.string().regex(/^\d+(\.\d+)?$/);

export const TopUpParamsSchema = z.object({
  processingFeePct: decimal,
  processingFeeMin: decimal,
  processingFeeMax: decimal,
  maxTenorMonths: z.number().int().min(6).max(360),
  dayCountBasis: z.union([z.literal(360), z.literal(365)]),
  roundingMode: RoundingModeSchema,
});
export type TopUpParams = z.infer<typeof TopUpParamsSchema>;

export interface TopUpInput extends FinanceSettlementInput {
  topUpAmount: string;
  newTenorMonths: number;
}

export const TOP_UP_FACT_KEYS = [
  "topUpAmount",
  "currentInstalment",
  "remainingMonths",
  "remainingCost",
  "refinancedAmount",
  "newFinancedAmount",
  "newTenorMonths",
  "newInstalment",
  "newTotalCost",
  "totalCostSameTenor",
  "extraCostOfExtension",
  "processingFee",
] as const;
export type TopUpFactKey = (typeof TOP_UP_FACT_KEYS)[number];

/**
 * finance.top_up: adding cash to a finance and (usually) extending its tenor. The existing finance
 * is refinanced at today's settlement amount (fee or ibra included), then priced over the new
 * tenor. The cost of the extension is compared with pricing the same new amount over the months
 * that remain today.
 *
 * Worked example (the 3-month conventional loan from the Phase 2 fixtures, on 2026-02-25):
 *   refinanced 2,036.64 (settlement today: 2,009.93 + 10 days' interest 6.61 + 1% fee 20.10)
 *   + top-up 1,000.00 = 3,036.64
 *   new: 12 months at 12% -> 269.80 × 12 = 3,237.60; same tenor (2 months) 1,541.13 × 2 = 3,082.26
 *   extension costs 155.34 more; fee max(1% × 1,000, 100) = 100.00
 */
export function evaluateTopUp(
  input: TopUpInput,
  params: TopUpParams,
  thresholds: SeverityThresholds,
  now: Date,
): Evaluation<TopUpFactKey> {
  const mode = params.roundingMode;
  const asOf = isoDate(input.dataAsOf);
  const today = startOfUtcDay(now);
  const { finance } = input;
  const unpaid = finance.schedule.filter((e) => !e.paid);
  const remainingMonths = unpaid.length;
  const remainingCost = sum(unpaid.map((e) => D(e.instalment)));
  const currentInstalment = D(unpaid[0]?.instalment ?? "0");
  const settlement = quoteSettlement(
    input,
    {
      horizonDays: 0,
      dayCountBasis: params.dayCountBasis,
      roundingMode: mode,
      partialPrepaymentAllowed: false,
    },
    today,
    today,
  );
  const topUp = D(input.topUpAmount);
  const newAmount = settlement.settlementAmount.plus(topUp);
  const rate = D(finance.ratePct);
  const price = (months: number): { instalment: Dec; total: Dec } => {
    if (months <= 0) return { instalment: D(0), total: D(0) };
    const instalment =
      finance.type === "murabaha"
        ? flatInstalment(newAmount, rate, months, mode).instalment
        : annuityInstalment(newAmount, rate, months, mode);
    return { instalment, total: instalment.times(months) };
  };
  const tenor = Math.min(input.newTenorMonths, params.maxTenorMonths);
  const next = price(tenor);
  const same = price(remainingMonths);
  const extension = max(next.total.minus(same.total), D(0));
  const fee = round(
    clamp(
      percentOf(topUp, D(params.processingFeePct)),
      D(params.processingFeeMin),
      D(params.processingFeeMax),
    ),
    mode,
  );

  const f = new FactBuilder<TopUpFactKey>()
    .add("topUpAmount", toMoneyString(topUp), "QAR", "computed", asOf)
    .add("currentInstalment", toMoneyString(currentInstalment), "QAR", "finance_schedule", asOf)
    .add("remainingMonths", String(remainingMonths), "months", "finance_schedule", asOf)
    .add("remainingCost", toMoneyString(remainingCost), "QAR", "finance_schedule", asOf)
    .add("refinancedAmount", toMoneyString(settlement.settlementAmount), "QAR", "computed", asOf)
    .add("newFinancedAmount", toMoneyString(newAmount), "QAR", "computed", asOf)
    .add("newTenorMonths", String(tenor), "months", "computed", asOf)
    .add("newInstalment", toMoneyString(next.instalment), "QAR", "computed", asOf)
    .add("newTotalCost", toMoneyString(next.total), "QAR", "computed", asOf)
    .add("totalCostSameTenor", toMoneyString(same.total), "QAR", "computed", asOf)
    .add("extraCostOfExtension", toMoneyString(extension), "QAR", "computed", asOf)
    .add("processingFee", toMoneyString(fee), "QAR", "rule_pack", asOf);

  const basis = extension.plus(fee);
  const severity = severityForAmount(basis, thresholds);
  const extends_ = tenor > remainingMonths;
  return {
    applicable: topUp.greaterThan(0) && remainingMonths > 0,
    severity,
    facts: f.build(),
    options: extends_
      ? ["choose_shorter_tenor", "continue_top_up", "talk_to_someone"]
      : ["continue_top_up", "talk_to_someone"],
    explanation: [
      ...(extends_ ? ["top_up_extends_tenor"] : []),
      "top_up_has_processing_fee",
      `severity_basis_qar:${toMoneyString(basis)}`,
      `severity:${severity}`,
    ],
  };
}
