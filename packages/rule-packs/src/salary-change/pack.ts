import {
  D,
  type Dec,
  type Evaluation,
  FactBuilder,
  isoDate,
  type SeverityThresholds,
  severityForAmount,
  sum,
  toFixedString,
  toMoneyString,
} from "@amil/rules-engine";
import { z } from "zod";
import { RoundingModeSchema } from "../define";
import type { ScheduleEntry } from "../rules";
import { annuityInstalment } from "../shared/finance-math";

const decimal = z.string().regex(/^\d+(\.\d+)?$/);

export const SalaryChangeParamsSchema = z.object({
  /** Percentage points added to salary-linked pricing when the salary leaves (bank policy). */
  rateUpliftPct: decimal,
  /** Whether the bank requires salary-linked finance to be cleared before the switch. */
  clearanceRequired: z.boolean(),
  roundingMode: RoundingModeSchema,
});
export type SalaryChangeParams = z.infer<typeof SalaryChangeParamsSchema>;

export interface SalaryChangeInput {
  dataAsOf: Date;
  variant: "conventional" | "islamic";
  salaryTransfer: boolean;
  accounts: { id: string; maintenanceFee: string; maintenanceFeeWaived: boolean }[];
  cards: { id: string; annualFee: string; annualFeeWaived: boolean }[];
  finances: {
    id: string;
    type: "conventional" | "murabaha" | "ijara";
    ratePct: string;
    salaryLinked: boolean;
    schedule: ScheduleEntry[];
  }[];
}

export const SALARY_CHANGE_FACT_KEYS = [
  "salaryLinkedFinances",
  "currentRatePct",
  "newRatePct",
  "currentInstalmentTotal",
  "newInstalmentTotal",
  "instalmentIncrease",
  "extraCostRemainingTerm",
  "outstandingSalaryLinked",
  "clearanceRequired",
  "maintenanceFeeWaivedMonthly",
  "annualFeesWaived",
  "waiversLostAnnual",
] as const;
export type SalaryChangeFactKey = (typeof SALARY_CHANGE_FACT_KEYS)[number];

/**
 * salary.transfer_change: what changes when the customer moves their salary away. Salary-linked
 * conventional and ijara pricing is repriced at the bank's uplift over the remaining term
 * (murabaha sale prices are fixed, so they do not change); salary-linked fee waivers end.
 *
 * Worked example (Omar): 5.99% loan, 42 instalments left on 109,604.62 at 2,899.22.
 *   uplift 1.50 pts -> 7.49%: new instalment over 42 months = annuity(109,604.62, 7.49%, 42)
 *   waivers: account fee 25.00 a month and card annual fee 500.00 -> 800.00 a year
 */
export function evaluateSalaryChange(
  input: SalaryChangeInput,
  params: SalaryChangeParams,
  thresholds: SeverityThresholds,
): Evaluation<SalaryChangeFactKey> {
  const mode = params.roundingMode;
  const asOf = isoDate(input.dataAsOf);
  const uplift = D(params.rateUpliftPct);
  const linked = input.finances.filter((f) => f.salaryLinked);
  let current = D(0);
  let next = D(0);
  let extra = D(0);
  const outstanding: Dec[] = [];
  for (const f of linked) {
    const unpaid = f.schedule.filter((e) => !e.paid);
    const principal = sum(unpaid.map((e) => D(e.principal)));
    outstanding.push(principal);
    const instalment = D(unpaid[0]?.instalment ?? "0");
    current = current.plus(instalment);
    if (f.type === "murabaha" || unpaid.length === 0) {
      next = next.plus(instalment);
      continue;
    }
    const repriced = annuityInstalment(principal, D(f.ratePct).plus(uplift), unpaid.length, mode);
    next = next.plus(repriced);
    extra = extra.plus(repriced.minus(instalment).times(unpaid.length));
  }
  // Rates shown are those of the first finance that is actually repriced (murabaha is not).
  const repriced = linked.find((f) => f.type !== "murabaha" && f.schedule.some((e) => !e.paid));
  const currentRate = repriced ? D(repriced.ratePct) : D(0);
  const maintenance = sum(
    input.accounts.filter((a) => a.maintenanceFeeWaived).map((a) => D(a.maintenanceFee)),
  );
  const cardFees = sum(input.cards.filter((c) => c.annualFeeWaived).map((c) => D(c.annualFee)));
  const waivers = maintenance.times(12).plus(cardFees);

  const f = new FactBuilder<SalaryChangeFactKey>()
    .add("salaryLinkedFinances", String(linked.length), "count", "finance", asOf)
    .add("currentRatePct", toFixedString(currentRate, 2), "percent", "finance", asOf)
    .add(
      "newRatePct",
      toFixedString(repriced ? currentRate.plus(uplift) : D(0), 2),
      "percent",
      "rule_pack",
      asOf,
    )
    .add("currentInstalmentTotal", toMoneyString(current), "QAR", "finance_schedule", asOf)
    .add("newInstalmentTotal", toMoneyString(next), "QAR", "computed", asOf)
    .add("instalmentIncrease", toMoneyString(next.minus(current)), "QAR", "computed", asOf)
    .add("extraCostRemainingTerm", toMoneyString(extra), "QAR", "computed", asOf)
    .add(
      "outstandingSalaryLinked",
      toMoneyString(sum(outstanding)),
      "QAR",
      "finance_schedule",
      asOf,
    )
    .add(
      "clearanceRequired",
      String(params.clearanceRequired && linked.length > 0),
      "boolean",
      "rule_pack",
      asOf,
    )
    .add("maintenanceFeeWaivedMonthly", toMoneyString(maintenance), "QAR", "account", asOf)
    .add("annualFeesWaived", toMoneyString(cardFees), "QAR", "card", asOf)
    .add("waiversLostAnnual", toMoneyString(waivers), "QAR", "computed", asOf);

  const basis = extra.plus(waivers);
  const severity = severityForAmount(basis, thresholds);
  const explanation: string[] = [];
  if (linked.length > 0) explanation.push("salary_linked_pricing_changes");
  if (waivers.greaterThan(0)) explanation.push("salary_linked_waivers_end");
  explanation.push(`severity_basis_qar:${toMoneyString(basis)}`, `severity:${severity}`);
  return {
    applicable: input.salaryTransfer && (linked.length > 0 || waivers.greaterThan(0)),
    severity,
    facts: f.build(),
    options: ["view_linked_benefits", "continue_salary_change", "talk_to_someone"],
    explanation,
  };
}
