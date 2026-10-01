import { D, type Dec, round, type RoundingMode } from "@amil/rules-engine";

/**
 * Level instalment for a reducing-balance loan: P·r / (1 − (1+r)^−n), r = rate / 12 / 100.
 * A zero rate gives P / n. Example: 10,000 at 12% over 12 months = 888.49.
 */
export function annuityInstalment(
  principal: Dec,
  ratePct: Dec,
  months: number,
  mode: RoundingMode,
): Dec {
  if (months <= 0) throw new RangeError("months must be positive");
  const r = ratePct.dividedBy(1200);
  if (r.isZero()) return round(principal.dividedBy(months), mode);
  return round(principal.times(r).dividedBy(D(1).minus(r.plus(1).pow(-months))), mode);
}

/**
 * Flat (murabaha) pricing fixed at inception: profit = cost × rate × months/12; the sale price is
 * cost + profit, paid in equal instalments. Example: 12,000 at 5% over 12 months: profit 600,
 * instalment 1,050.
 */
export function flatInstalment(
  cost: Dec,
  ratePct: Dec,
  months: number,
  mode: RoundingMode,
): { profit: Dec; instalment: Dec } {
  if (months <= 0) throw new RangeError("months must be positive");
  const profit = round(cost.times(ratePct).dividedBy(100).times(months).dividedBy(12), mode);
  return { profit, instalment: round(cost.plus(profit).dividedBy(months), mode) };
}

export interface RevolvingPlan {
  /** Payment for a month, given the balance owed at the start of that month (before interest). */
  payment: (balance: Dec) => Dec;
  aprPct: Dec;
  maxMonths: number;
  mode: RoundingMode;
}

export interface RevolvingResult {
  months: number;
  totalPaid: Dec;
  totalInterest: Dec;
  /** false if the balance was not cleared within maxMonths (the payment does not cover interest). */
  clears: boolean;
}

/**
 * Revolving card balance paid down month by month: each month the payment is taken from the
 * balance, then interest (or profit) at APR/12 is charged on what remains.
 * Example: 1,000 at 24% paying 500/month: m1 pay 500 -> 500 + 10.00 = 510.00;
 * m2 pay 500 -> 10.00 + 0.20 = 10.20; m3 pay 10.20 -> 0. Total paid 1,010.20, interest 10.20.
 */
export function amortiseRevolving(start: Dec, plan: RevolvingPlan): RevolvingResult {
  const r = plan.aprPct.dividedBy(1200);
  let balance = start;
  let totalPaid = D(0);
  let totalInterest = D(0);
  let months = 0;
  while (balance.greaterThan(0) && months < plan.maxMonths) {
    months++;
    const pay = Dec_min(plan.payment(balance), balance);
    totalPaid = totalPaid.plus(pay);
    const remaining = balance.minus(pay);
    const interest = round(remaining.times(r), plan.mode);
    totalInterest = totalInterest.plus(interest);
    balance = remaining.plus(interest);
  }
  return { months, totalPaid, totalInterest, clears: balance.lessThanOrEqualTo(0) };
}

const Dec_min = (a: Dec, b: Dec): Dec => (a.lessThan(b) ? a : b);
