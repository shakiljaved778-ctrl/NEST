import {
  addDays,
  addMonths,
  clamp,
  D,
  type Dec,
  type Evaluation,
  FactBuilder,
  isoDate,
  max,
  type OptionKey,
  percentOf,
  proRata,
  round,
  type SeverityThresholds,
  severityForAmount,
  startOfUtcDay,
  sum,
  toFixedString,
  toMoneyString,
} from "@amil/rules-engine";
import type { CardCloseFactKey, CardCloseInput, CardCloseParams } from "./types";
import type { EarlyClosureFeeRule } from "../rules";

/**
 * card.close: what the customer gains or loses by closing a credit card.
 *
 * Worked example (Khalid, seed now = 2026-09-30):
 *   points 42,000 x QAR 0.0100        = 420.00 forfeited
 *   expiring within 90 days            = 8,000 points (80.00), next expiry 2026-11-14
 *   EPP: 3,600.00 remaining + 2% fee   = 3,600.00 + 72.00 = 3,672.00 payable on closure
 *   annual fee 1,500.00 charged 2 months ago, pro-rata over 12 months:
 *     months used 2 -> refund 1,500 x 10/12 = 1,250.00
 *   net to clear = 6,250.00 + 3,672.00 - 1,250.00 = 8,672.00
 *   severity basis = forfeited 420.00 + early-closure fees 72.00 = 492.00 >= 250 -> critical
 */
export function evaluateCardClose(
  input: CardCloseInput,
  params: CardCloseParams,
  thresholds: SeverityThresholds,
  now: Date,
): Evaluation<CardCloseFactKey> {
  const mode = params.roundingMode;
  const today = startOfUtcDay(now);
  const cardAsOf = isoDate(input.dataAsOf);
  const f = new FactBuilder<CardCloseFactKey>();
  const explanation: string[] = [];

  // ── Rewards ─────────────────────────────────────────────────────────────────────────────────
  const rewards = input.rewards;
  const rewardsAsOf = rewards ? isoDate(rewards.asOf) : cardAsOf;
  const points = rewards?.balance ?? 0;
  const pointValue = D(rewards?.pointValueQar ?? "0");
  const pointsValue = round(D(points).times(pointValue), mode);
  const windowEnd = addDays(today, params.pointsExpiryWindowDays);
  const expiringSoon = (rewards?.expiryBuckets ?? []).filter((b) => {
    const at = new Date(`${b.expiresAt}T00:00:00.000Z`);
    return at >= today && at <= windowEnd;
  });
  const expiringPoints = expiringSoon.reduce((s, b) => s + b.points, 0);
  const nextExpiry = expiringSoon.map((b) => b.expiresAt).sort()[0] ?? "";
  const pendingCashback = D(rewards?.pendingCashback ?? "0");
  const cashbackForfeited =
    params.pendingCashbackOnClosure === "forfeited" ? pendingCashback : D(0);
  const forfeitedValue = pointsValue.plus(cashbackForfeited);

  f.add("pointsBalance", String(points), "points", "rewards_ledger", rewardsAsOf)
    .add("pointValueQar", toFixedString(pointValue, 4), "QAR", "rewards_ledger", rewardsAsOf)
    .add("pointsValue", toMoneyString(pointsValue), "QAR", "rewards_ledger", rewardsAsOf)
    .add("pointsExpiringSoon", String(expiringPoints), "points", "rewards_ledger", rewardsAsOf)
    .add(
      "pointsExpiringSoonValue",
      toMoneyString(round(D(expiringPoints).times(pointValue), mode)),
      "QAR",
      "rewards_ledger",
      rewardsAsOf,
    )
    .add("nextPointsExpiryDate", nextExpiry, "date", "rewards_ledger", rewardsAsOf)
    .add(
      "pointsExpiryWindowDays",
      String(params.pointsExpiryWindowDays),
      "days",
      "rule_pack",
      cardAsOf,
    )
    .add("pendingCashback", toMoneyString(pendingCashback), "QAR", "rewards_ledger", rewardsAsOf)
    .add(
      "pendingCashbackForfeited",
      toMoneyString(cashbackForfeited),
      "QAR",
      "computed",
      rewardsAsOf,
    )
    .add("forfeitedValue", toMoneyString(forfeitedValue), "QAR", "computed", rewardsAsOf);

  if (points > 0) explanation.push("points_forfeited_on_closure");
  if (expiringPoints > 0)
    explanation.push(`points_expiring_within_${params.pointsExpiryWindowDays}_days`);
  if (cashbackForfeited.greaterThan(0)) explanation.push("pending_cashback_forfeited");

  // ── Instalment plans ───────────────────────────────────────────────────────────────────────
  const active = input.instalmentPlans.filter((p) => D(p.principalRemaining).greaterThan(0));
  const remaining = sum(active.map((p) => D(p.principalRemaining)));
  const closureFees = sum(
    active.map((p) => earlyClosureFee(D(p.principalRemaining), p.earlyClosureFeeRule, params)),
  );
  const instalmentsPayable = remaining.plus(closureFees);
  f.add("activeInstalmentPlans", String(active.length), "count", "instalment_plan", cardAsOf)
    .add(
      "instalmentsRemainingPrincipal",
      toMoneyString(remaining),
      "QAR",
      "instalment_plan",
      cardAsOf,
    )
    .add(
      "instalmentEarlyClosureFees",
      toMoneyString(closureFees),
      "QAR",
      "instalment_plan",
      cardAsOf,
    )
    .add(
      "instalmentsPayableOnClosure",
      toMoneyString(instalmentsPayable),
      "QAR",
      "computed",
      cardAsOf,
    );
  if (active.length > 0) explanation.push("active_instalment_plans_become_payable");
  if (closureFees.greaterThan(0)) explanation.push("instalment_early_closure_fees_apply");

  // ── Annual fee refund ──────────────────────────────────────────────────────────────────────
  const { refund, monthsUsed, eligible } = annualFeeRefund(input, params, today);
  f.add("annualFee", toMoneyString(D(input.card.annualFee)), "QAR", "card", cardAsOf)
    .add("annualFeeRefundEligible", String(eligible), "boolean", "card", cardAsOf)
    .add("annualFeeMonthsUsed", String(monthsUsed), "months", "computed", cardAsOf)
    .add("annualFeeRefund", toMoneyString(refund), "QAR", "computed", cardAsOf);
  if (eligible) explanation.push("annual_fee_pro_rata_refund_due");

  // ── Supplementary cards and balance ────────────────────────────────────────────────────────
  const outstanding = D(input.card.balance);
  const netToClear = max(outstanding.plus(instalmentsPayable).minus(refund), D(0));
  f.add("supplementaryCards", String(input.card.supplementaryCount), "count", "card", cardAsOf)
    .add("outstandingBalance", toMoneyString(outstanding), "QAR", "card", cardAsOf)
    .add("netAmountToClear", toMoneyString(netToClear), "QAR", "computed", cardAsOf);
  if (input.card.supplementaryCount > 0) explanation.push("supplementary_cards_close_too");
  if (outstanding.greaterThan(0)) explanation.push("outstanding_balance_to_clear");

  // ── Severity, applicability and options ────────────────────────────────────────────────────
  // Basis: the avoidable loss from closing now = forfeited value + early-closure fees (D-012).
  const severityBasis = forfeitedValue.plus(closureFees);
  f.add("avoidableLoss", toMoneyString(severityBasis), "QAR", "computed", cardAsOf);
  const severity = severityForAmount(severityBasis, thresholds);
  explanation.push(`severity_basis_qar:${toMoneyString(severityBasis)}`, `severity:${severity}`);

  const applicable =
    forfeitedValue.greaterThan(0) ||
    active.length > 0 ||
    outstanding.greaterThan(0) ||
    input.card.supplementaryCount > 0 ||
    refund.greaterThan(0);

  const options: OptionKey[] = [];
  if (points > 0) options.push("redeem_points");
  if (active.length > 0) options.push("view_instalments");
  options.push("continue_closure", "talk_to_someone");

  return { applicable, severity, facts: f.build(), options, explanation };
}

function earlyClosureFee(remaining: Dec, rule: EarlyClosureFeeRule, params: CardCloseParams): Dec {
  switch (rule.type) {
    case "none":
      return D(0);
    case "fixed":
      return D(rule.amount);
    case "pct_of_remaining":
      return round(
        clamp(
          percentOf(remaining, D(rule.pct)),
          rule.min ? D(rule.min) : undefined,
          rule.max ? D(rule.max) : undefined,
        ),
        params.roundingMode,
      );
  }
}

/**
 * Pro-rata annual-fee refund. Months "used" counts every started month since the fee was
 * charged (a partial month counts as used), so the refund is never overstated (D-011).
 */
function annualFeeRefund(
  input: CardCloseInput,
  params: CardCloseParams,
  today: Date,
): { refund: Dec; monthsUsed: number; eligible: boolean } {
  const { card } = input;
  const rule = card.feeRefundRule;
  const fee = D(card.annualFee);
  if (rule.type === "none" || card.annualFeeWaived || fee.isZero() || !card.annualFeeChargedAt) {
    return { refund: D(0), monthsUsed: 0, eligible: false };
  }
  const charged = startOfUtcDay(card.annualFeeChargedAt);
  let fullMonths = 0;
  while (addMonths(charged, fullMonths + 1) <= today) fullMonths++;
  const monthsUsed = addMonths(charged, fullMonths) < today ? fullMonths + 1 : fullMonths;
  const cycle = D(rule.withinMonths);
  if (D(monthsUsed).greaterThanOrEqualTo(cycle)) {
    return { refund: D(0), monthsUsed, eligible: false };
  }
  const refund = round(proRata(fee, cycle.minus(monthsUsed), cycle), params.roundingMode);
  return { refund, monthsUsed, eligible: refund.greaterThan(0) };
}
