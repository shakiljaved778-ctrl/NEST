import {
  addDays,
  D,
  daysBetween,
  type Evaluation,
  FactBuilder,
  isoDate,
  startOfUtcDay,
  toMoneyString,
} from "@amil/rules-engine";
import { z } from "zod";

export const AccountDormancyParamsSchema = z
  .object({
    /** Alert when the account will turn dormant within this many days. */
    warnWithinDays: z.number().int().min(1).max(365),
    /** Critical when it will turn dormant within this many days. */
    criticalWithinDays: z.number().int().min(1).max(365),
  })
  .refine((p) => p.criticalWithinDays <= p.warnWithinDays, "criticalWithinDays <= warnWithinDays");
export type AccountDormancyParams = z.infer<typeof AccountDormancyParamsSchema>;

export interface AccountDormancyInput {
  dataAsOf: Date;
  account: {
    id: string;
    variant: "conventional" | "islamic";
    balance: string;
    status: "active" | "dormant" | "restricted" | "closed";
    lastActivityAt: Date;
    dormancyDays: number;
  };
}

export const ACCOUNT_DORMANCY_FACT_KEYS = [
  "currentBalance",
  "lastActivityDate",
  "daysSinceLastActivity",
  "dormancyPeriodDays",
  "dormancyDate",
  "daysUntilDormancy",
] as const;
export type AccountDormancyFactKey = (typeof ACCOUNT_DORMANCY_FACT_KEYS)[number];

/**
 * account.dormancy (proactive): an active account approaching the bank's dormancy period. Any
 * customer-initiated transaction resets the clock. Severity is by time, not money: the balance
 * is not lost, but a dormant account is restricted until reactivated.
 *
 * Worked example (Grace): last activity 340 days ago, dormancy after 365 -> dormant in 25 days
 * (<= 30: critical). Tariq: 320 days ago -> 45 days (<= 60: caution).
 */
export function evaluateAccountDormancy(
  input: AccountDormancyInput,
  params: AccountDormancyParams,
  now: Date,
): Evaluation<AccountDormancyFactKey> {
  const asOf = isoDate(input.dataAsOf);
  const today = startOfUtcDay(now);
  const { account } = input;
  const last = startOfUtcDay(account.lastActivityAt);
  const since = daysBetween(last, today);
  const dormancyDate = addDays(last, account.dormancyDays);
  const until = daysBetween(today, dormancyDate);

  const f = new FactBuilder<AccountDormancyFactKey>()
    .add("currentBalance", toMoneyString(D(account.balance)), "QAR", "account", asOf)
    .add("lastActivityDate", isoDate(last), "date", "account", asOf)
    .add("daysSinceLastActivity", String(since), "days", "computed", asOf)
    .add("dormancyPeriodDays", String(account.dormancyDays), "days", "account", asOf)
    .add("dormancyDate", isoDate(dormancyDate), "date", "computed", asOf)
    .add("daysUntilDormancy", String(until), "days", "computed", asOf);

  const severity = until <= params.criticalWithinDays ? "critical" : "caution";
  return {
    applicable: account.status === "active" && until > 0 && until <= params.warnWithinDays,
    severity,
    facts: f.build(),
    options: ["make_a_transaction", "talk_to_someone"],
    explanation: [
      "account_nearing_dormancy",
      "any_transaction_keeps_account_active",
      `severity:${severity}`,
    ],
  };
}
