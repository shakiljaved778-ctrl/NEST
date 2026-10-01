import {
  D,
  daysBetween,
  type Evaluation,
  FactBuilder,
  isoDate,
  max,
  maxSeverity,
  type Severity,
  type SeverityThresholds,
  severityForAmount,
  startOfUtcDay,
  sum,
  toMoneyString,
} from "@amil/rules-engine";
import { z } from "zod";
import { RoundingModeSchema } from "../define";

export const AccountCloseParamsSchema = z.object({
  /** Standing orders due within this many days are called out as the next payment to fail. */
  standingOrderHorizonDays: z.number().int().min(1).max(365),
  roundingMode: RoundingModeSchema,
});
export type AccountCloseParams = z.infer<typeof AccountCloseParamsSchema>;

export interface AccountCloseInput {
  dataAsOf: Date;
  account: {
    id: string;
    variant: "conventional" | "islamic";
    balance: string;
    closureFee: string;
    chequesOutstanding: number;
    isSalaryAccount: boolean;
    standingOrders: { amount: string; nextRunAt: Date; active: boolean }[];
  };
  /** Cards that settle from this account. */
  linkedCards: number;
  /** Salary-linked finances, which depend on the salary arriving in this account. */
  salaryLinkedFinances: number;
}

export const ACCOUNT_CLOSE_FACT_KEYS = [
  "currentBalance",
  "closureFee",
  "netPayout",
  "chequesOutstanding",
  "activeStandingOrders",
  "standingOrdersTotal",
  "nextStandingOrderDate",
  "nextStandingOrderAmount",
  "standingOrdersDueSoon",
  "linkedCards",
  "receivesSalary",
  "salaryLinkedFinances",
] as const;
export type AccountCloseFactKey = (typeof ACCOUNT_CLOSE_FACT_KEYS)[number];

/**
 * account.close: what stops working when an account closes. Severity is driven by what can
 * bounce or break, not only by money: outstanding cheques and salary-linked finances are
 * critical, standing orders, linked cards and a salary account are caution. The closure fee sets
 * a floor through the bank's thresholds.
 *
 * Worked example (Hessa): balance 14,250.00, closure fee 25.00 -> payout 14,225.00; 3 cheques
 * outstanding and 2 standing orders (3,500.00 + 450.00 = 3,950.00) -> critical.
 */
export function evaluateAccountClose(
  input: AccountCloseInput,
  params: AccountCloseParams,
  thresholds: SeverityThresholds,
  now: Date,
): Evaluation<AccountCloseFactKey> {
  const asOf = isoDate(input.dataAsOf);
  const today = startOfUtcDay(now);
  const { account } = input;
  const balance = D(account.balance);
  const fee = D(account.closureFee);
  const orders = account.standingOrders
    .filter((o) => o.active)
    .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());
  const next = orders[0];
  const dueSoon = orders.filter(
    (o) => daysBetween(today, o.nextRunAt) <= params.standingOrderHorizonDays,
  ).length;

  const f = new FactBuilder<AccountCloseFactKey>()
    .add("currentBalance", toMoneyString(balance), "QAR", "account", asOf)
    .add("closureFee", toMoneyString(fee), "QAR", "fee_schedule", asOf)
    .add("netPayout", toMoneyString(max(balance.minus(fee), D(0))), "QAR", "computed", asOf)
    .add("chequesOutstanding", String(account.chequesOutstanding), "count", "account", asOf)
    .add("activeStandingOrders", String(orders.length), "count", "standing_order", asOf)
    .add(
      "standingOrdersTotal",
      toMoneyString(sum(orders.map((o) => D(o.amount)))),
      "QAR",
      "standing_order",
      asOf,
    )
    .add(
      "nextStandingOrderDate",
      next ? isoDate(next.nextRunAt) : "",
      "date",
      "standing_order",
      asOf,
    )
    .add(
      "nextStandingOrderAmount",
      toMoneyString(next ? D(next.amount) : D(0)),
      "QAR",
      "standing_order",
      asOf,
    )
    .add("standingOrdersDueSoon", String(dueSoon), "count", "standing_order", asOf)
    .add("linkedCards", String(input.linkedCards), "count", "card", asOf)
    .add("receivesSalary", String(account.isSalaryAccount), "boolean", "account", asOf)
    .add("salaryLinkedFinances", String(input.salaryLinkedFinances), "count", "finance", asOf);

  const explanation: string[] = [];
  const levels: Severity[] = [severityForAmount(fee, thresholds)];
  if (account.chequesOutstanding > 0) {
    explanation.push("cheques_outstanding_may_bounce");
    levels.push("critical");
  }
  if (account.isSalaryAccount && input.salaryLinkedFinances > 0) {
    explanation.push("salary_linked_finance_depends_on_account");
    levels.push("critical");
  }
  if (orders.length > 0) {
    explanation.push("standing_orders_stop");
    levels.push("caution");
  }
  if (input.linkedCards > 0) {
    explanation.push("linked_cards_need_new_account");
    levels.push("caution");
  }
  if (account.isSalaryAccount) {
    explanation.push("salary_account_closing");
    levels.push("caution");
  }
  if (fee.greaterThan(0)) explanation.push("closure_fee_applies");
  const severity = maxSeverity(...levels);
  explanation.push(`severity_basis_qar:${toMoneyString(fee)}`, `severity:${severity}`);
  return {
    applicable: explanation.length > 2,
    severity,
    facts: f.build(),
    options: [
      ...(orders.length > 0 ? (["review_standing_orders"] as const) : []),
      "continue_account_close",
      "talk_to_someone",
    ],
    explanation,
  };
}
