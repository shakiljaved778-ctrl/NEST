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
import { amortiseRevolving, flatInstalment } from "../shared/finance-math";

const decimal = z.string().regex(/^\d+(\.\d+)?$/);

export const EppConversionParamsSchema = z.object({
  minAmount: decimal,
  allowedMonths: z.array(z.number().int().min(2).max(60)).min(1),
  processingFeePct: decimal,
  processingFeeMin: decimal,
  /** Flat interest/profit rate on the plan (0 for the demo's fee-only plans). */
  planRatePct: decimal,
  earlyClosureFeePct: decimal,
  roundingMode: RoundingModeSchema,
});
export type EppConversionParams = z.infer<typeof EppConversionParamsSchema>;

export interface EppConversionInput {
  dataAsOf: Date;
  card: { id: string; variant: "conventional" | "islamic"; aprPct: string };
  purchase: { amount: string; transactionId?: string };
  months: number;
}

export const EPP_FACT_KEYS = [
  "purchaseAmount",
  "planMonths",
  "planMonthlyInstalment",
  "planProcessingFee",
  "planCharge",
  "planTotalCost",
  "extraCostVsPayInFull",
  "chargeIfRevolved",
  "planEarlyClosureFeePct",
] as const;
export type EppFactKey = (typeof EPP_FACT_KEYS)[number];

/**
 * card.epp_conversion: converting a purchase into an instalment plan, compared with paying it in
 * full by the due date (no charge) and with leaving it to revolve at the card's APR while paying
 * the same monthly amount.
 *
 * Worked example (Hamad, 4,800.00 over 6 months, fee 1.5% min 50, plan rate 0%, APR 30%):
 *   fee 72.00; instalment 800.00; plan total 4,872.00; extra vs paying in full 72.00
 *   revolving at 800/month (payment first, then 2.5% on the rest): 4,000 -> 4,100.00, 3,300 -> 3,382.50, …
 *   clears in 7 months with 328.58 interest
 */
export function evaluateEppConversion(
  input: EppConversionInput,
  params: EppConversionParams,
  thresholds: SeverityThresholds,
): Evaluation<EppFactKey> {
  const mode = params.roundingMode;
  const asOf = isoDate(input.dataAsOf);
  const amount = D(input.purchase.amount);
  const months = input.months;
  const fee = max(
    round(percentOf(amount, D(params.processingFeePct)), mode),
    D(params.processingFeeMin),
  );
  const { profit: charge, instalment } = flatInstalment(
    amount,
    D(params.planRatePct),
    months,
    mode,
  );
  const total = amount.plus(charge).plus(fee);
  const extra = fee.plus(charge);
  const revolving = amortiseRevolving(amount, {
    payment: () => instalment,
    aprPct: D(input.card.aprPct),
    maxMonths: 600,
    mode,
  });

  const f = new FactBuilder<EppFactKey>()
    .add("purchaseAmount", toMoneyString(amount), "QAR", "transaction", asOf)
    .add("planMonths", String(months), "months", "computed", asOf)
    .add("planMonthlyInstalment", toMoneyString(instalment), "QAR", "computed", asOf)
    .add("planProcessingFee", toMoneyString(fee), "QAR", "rule_pack", asOf)
    .add("planCharge", toMoneyString(charge), "QAR", "computed", asOf)
    .add("planTotalCost", toMoneyString(total), "QAR", "computed", asOf)
    .add("extraCostVsPayInFull", toMoneyString(extra), "QAR", "computed", asOf)
    .add("chargeIfRevolved", toMoneyString(revolving.totalInterest), "QAR", "computed", asOf)
    .add(
      "planEarlyClosureFeePct",
      toFixedString(D(params.earlyClosureFeePct), 2),
      "percent",
      "rule_pack",
      asOf,
    );

  const severity = severityForAmount(extra, thresholds);
  const eligible =
    amount.greaterThanOrEqualTo(D(params.minAmount)) && params.allowedMonths.includes(months);
  return {
    applicable: eligible,
    severity,
    facts: f.build(),
    options: ["pay_in_full", "continue_epp", "talk_to_someone"],
    explanation: [
      "instalment_plan_has_fee",
      "paying_in_full_by_due_date_has_no_charge",
      `severity_basis_qar:${toMoneyString(extra)}`,
      `severity:${severity}`,
    ],
  };
}
