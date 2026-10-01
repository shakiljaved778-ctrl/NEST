import {
  clamp,
  D,
  daysBetween,
  type Evaluation,
  FactBuilder,
  isoDate,
  max,
  percentOf,
  round,
  type SeverityThresholds,
  severityForAmount,
  startOfUtcDay,
  toFixedString,
  toMoneyString,
} from "@amil/rules-engine";
import { z } from "zod";
import { RoundingModeSchema } from "../define";

const decimal = z.string().regex(/^\d+(\.\d+)?$/);

export const DepositBreakParamsSchema = z.object({
  dayCountBasis: z.union([z.literal(360), z.literal(365)]),
  roundingMode: RoundingModeSchema,
});
export type DepositBreakParams = z.infer<typeof DepositBreakParamsSchema>;

export const BreakPenaltyRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("fixed"), amount: decimal }),
  z.object({
    type: z.literal("pct_of_principal"),
    pct: decimal,
    min: decimal.optional(),
    max: decimal.optional(),
  }),
]);
export const ProfitOnBreakRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("reduced_rate"), ratePct: decimal }),
]);

export interface DepositBreakInput {
  dataAsOf: Date;
  deposit: {
    id: string;
    variant: "conventional" | "islamic";
    principal: string;
    ratePct: string;
    startAt: Date;
    maturityAt: Date;
    breakPenaltyRule: z.infer<typeof BreakPenaltyRuleSchema>;
    profitOnBreakRule: z.infer<typeof ProfitOnBreakRuleSchema>;
  };
}

export const DEPOSIT_BREAK_FACT_KEYS = [
  "principal",
  "ratePct",
  "maturityDate",
  "daysToMaturity",
  "profitAtMaturity",
  "profitIfBrokenToday",
  "profitForfeited",
  "breakPenalty",
  "netReceivedNow",
  "netAtMaturity",
  "differenceIfKeptToMaturity",
] as const;
export type DepositBreakFactKey = (typeof DEPOSIT_BREAK_FACT_KEYS)[number];

/**
 * deposit.break: what breaking a term deposit (or Islamic term investment) today pays compared
 * with keeping it to maturity.
 *
 * Worked example (Aisha, 200,000 at 4.25%, 2025-10-09 -> 2026-10-09, today 2026-09-30):
 *   term 365 days, elapsed 356, 9 to maturity
 *   at maturity: 200,000 × 4.25% × 365/365 = 8,500.00 -> 208,500.00
 *   broken today: profit at reduced 0.25%: 200,000 × 0.25% × 356/365 = 487.67;
 *     penalty max(0.5% × 200,000, 250) = 1,000.00 -> 199,487.67
 *   accrued at contract rate 8,290.41 -> profit forfeited 7,802.74
 *   difference if kept 9,012.33 (critical)
 */
export function evaluateDepositBreak(
  input: DepositBreakInput,
  params: DepositBreakParams,
  thresholds: SeverityThresholds,
  now: Date,
): Evaluation<DepositBreakFactKey> {
  const mode = params.roundingMode;
  const asOf = isoDate(input.dataAsOf);
  const { deposit } = input;
  const principal = D(deposit.principal);
  const rate = D(deposit.ratePct);
  const today = startOfUtcDay(now);
  const termDays = daysBetween(deposit.startAt, deposit.maturityAt);
  const elapsed = Math.min(Math.max(daysBetween(deposit.startAt, today), 0), termDays);
  const daysToMaturity = termDays - elapsed;
  const profitFor = (pct: ReturnType<typeof D>, days: number) =>
    round(principal.times(pct).dividedBy(100).times(days).dividedBy(params.dayCountBasis), mode);

  const atMaturity = profitFor(rate, termDays);
  const accrued = profitFor(rate, elapsed);
  const onBreak =
    deposit.profitOnBreakRule.type === "reduced_rate"
      ? profitFor(D(deposit.profitOnBreakRule.ratePct), elapsed)
      : D(0);
  const rule = deposit.breakPenaltyRule;
  const penalty =
    rule.type === "none"
      ? D(0)
      : rule.type === "fixed"
        ? D(rule.amount)
        : round(
            clamp(
              percentOf(principal, D(rule.pct)),
              rule.min ? D(rule.min) : undefined,
              rule.max ? D(rule.max) : undefined,
            ),
            mode,
          );
  const netNow = principal.plus(onBreak).minus(penalty);
  const netAtMaturity = principal.plus(atMaturity);
  const difference = netAtMaturity.minus(netNow);

  const f = new FactBuilder<DepositBreakFactKey>()
    .add("principal", toMoneyString(principal), "QAR", "deposit", asOf)
    .add("ratePct", toFixedString(rate, 2), "percent", "deposit", asOf)
    .add("maturityDate", isoDate(deposit.maturityAt), "date", "deposit", asOf)
    .add("daysToMaturity", String(daysToMaturity), "days", "computed", asOf)
    .add("profitAtMaturity", toMoneyString(atMaturity), "QAR", "computed", asOf)
    .add("profitIfBrokenToday", toMoneyString(onBreak), "QAR", "computed", asOf)
    .add(
      "profitForfeited",
      toMoneyString(max(accrued.minus(onBreak), D(0))),
      "QAR",
      "computed",
      asOf,
    )
    .add("breakPenalty", toMoneyString(penalty), "QAR", "deposit", asOf)
    .add("netReceivedNow", toMoneyString(netNow), "QAR", "computed", asOf)
    .add("netAtMaturity", toMoneyString(netAtMaturity), "QAR", "computed", asOf)
    .add("differenceIfKeptToMaturity", toMoneyString(difference), "QAR", "computed", asOf);

  const severity = severityForAmount(difference, thresholds);
  const explanation = [
    "breaking_reduces_profit",
    `severity_basis_qar:${toMoneyString(difference)}`,
    `severity:${severity}`,
  ];
  if (penalty.greaterThan(0)) explanation.unshift("break_penalty_applies");
  return {
    applicable: daysToMaturity > 0,
    severity,
    facts: f.build(),
    options: ["keep_until_maturity", "continue_break", "talk_to_someone"],
    explanation,
  };
}
