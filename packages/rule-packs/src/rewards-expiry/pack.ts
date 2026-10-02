import {
  D,
  daysBetween,
  type Evaluation,
  FactBuilder,
  isoDate,
  round,
  type SeverityThresholds,
  severityForAmount,
  startOfUtcDay,
  toMoneyString,
} from "@amil/rules-engine";
import { z } from "zod";
import { RoundingModeSchema } from "../define";

export const RewardsExpiryParamsSchema = z
  .object({
    /** Three cumulative look-ahead windows, e.g. 30 / 60 / 90 days. The widest decides applicability. */
    shortWindowDays: z.number().int().min(1).max(365),
    midWindowDays: z.number().int().min(1).max(365),
    longWindowDays: z.number().int().min(1).max(365),
    /** The rewards programme's QAR value of one point (bank-set); null keeps the ledger's value. */
    programmePointValueQar: z
      .string()
      .regex(/^\d{1,3}(\.\d{1,4})?$/)
      .nullable(),
    roundingMode: RoundingModeSchema,
  })
  .refine(
    (p) => p.shortWindowDays < p.midWindowDays && p.midWindowDays < p.longWindowDays,
    "windows must increase",
  );
export type RewardsExpiryParams = z.infer<typeof RewardsExpiryParamsSchema>;

export interface RewardsExpiryInput {
  dataAsOf: Date;
  card: {
    id: string;
    variant: "conventional" | "islamic";
    status: "active" | "blocked" | "closed";
  };
  rewards: {
    balance: number;
    pointValueQar: string;
    expiryBuckets: { points: number; expiresAt: string }[];
    asOf: Date;
  };
}

export const REWARDS_EXPIRY_FACT_KEYS = [
  "pointsBalance",
  "pointsValue",
  "shortWindowDays",
  "pointsExpiringShort",
  "pointsExpiringShortValue",
  "midWindowDays",
  "pointsExpiringMid",
  "pointsExpiringMidValue",
  "longWindowDays",
  "pointsExpiringLong",
  "pointsExpiringLongValue",
  "nextExpiryDate",
  "nextExpiryPoints",
  "nextExpiryValue",
  "daysUntilNextExpiry",
] as const;
export type RewardsExpiryFactKey = (typeof REWARDS_EXPIRY_FACT_KEYS)[number];

/**
 * rewards.expiry (proactive): reward points due to expire in the next 30, 60 and 90 days
 * (cumulative), valued at the card's point value. Severity follows the value expiring within the
 * widest window.
 *
 * Worked example (Khalid): 42,000 points at 0.01; a bucket of 8,000 expiring in 45 days.
 *   30 days: 0; 60 days: 8,000 (80.00); 90 days: 8,000 (80.00); next expiry 8,000 in 45 days.
 */
export function evaluateRewardsExpiry(
  input: RewardsExpiryInput,
  params: RewardsExpiryParams,
  thresholds: SeverityThresholds,
  now: Date,
): Evaluation<RewardsExpiryFactKey> {
  const mode = params.roundingMode;
  const asOf = isoDate(input.dataAsOf);
  const today = startOfUtcDay(now);
  const { rewards } = input;
  const pointValue = D(params.programmePointValueQar ?? rewards.pointValueQar);
  const value = (points: number) => round(pointValue.times(points), mode);
  const upcoming = rewards.expiryBuckets
    .map((b) => ({ points: b.points, at: new Date(`${b.expiresAt}T00:00:00Z`) }))
    .filter((b) => b.points > 0 && daysBetween(today, b.at) >= 0)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const within = (days: number) =>
    upcoming.filter((b) => daysBetween(today, b.at) <= days).reduce((n, b) => n + b.points, 0);
  const short = within(params.shortWindowDays);
  const mid = within(params.midWindowDays);
  const long = within(params.longWindowDays);
  const next = upcoming[0];
  const nextPoints = next
    ? upcoming.filter((b) => b.at.getTime() === next.at.getTime()).reduce((n, b) => n + b.points, 0)
    : 0;

  const f = new FactBuilder<RewardsExpiryFactKey>()
    .add("pointsBalance", String(rewards.balance), "points", "rewards_ledger", asOf)
    .add("pointsValue", toMoneyString(value(rewards.balance)), "QAR", "computed", asOf)
    .add("shortWindowDays", String(params.shortWindowDays), "days", "rule_pack", asOf)
    .add("pointsExpiringShort", String(short), "points", "rewards_ledger", asOf)
    .add("pointsExpiringShortValue", toMoneyString(value(short)), "QAR", "computed", asOf)
    .add("midWindowDays", String(params.midWindowDays), "days", "rule_pack", asOf)
    .add("pointsExpiringMid", String(mid), "points", "rewards_ledger", asOf)
    .add("pointsExpiringMidValue", toMoneyString(value(mid)), "QAR", "computed", asOf)
    .add("longWindowDays", String(params.longWindowDays), "days", "rule_pack", asOf)
    .add("pointsExpiringLong", String(long), "points", "rewards_ledger", asOf)
    .add("pointsExpiringLongValue", toMoneyString(value(long)), "QAR", "computed", asOf)
    .add("nextExpiryDate", next ? isoDate(next.at) : "", "date", "rewards_ledger", asOf)
    .add("nextExpiryPoints", String(nextPoints), "points", "rewards_ledger", asOf)
    .add("nextExpiryValue", toMoneyString(value(nextPoints)), "QAR", "computed", asOf)
    .add(
      "daysUntilNextExpiry",
      String(next ? daysBetween(today, next.at) : 0),
      "days",
      "computed",
      asOf,
    );

  const severity = severityForAmount(value(long), thresholds);
  return {
    applicable: input.card.status === "active" && long > 0,
    severity,
    facts: f.build(),
    options: ["redeem_points", "talk_to_someone"],
    explanation: [
      `points_expiring_within_${params.longWindowDays}_days`,
      "redeeming_before_expiry_keeps_value",
      `severity_basis_qar:${toMoneyString(value(long))}`,
      `severity:${severity}`,
    ],
  };
}
