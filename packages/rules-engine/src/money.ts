import Decimal from "decimal.js";

/**
 * Money arithmetic for AMIL (non-negotiable 10).
 *
 * - All money is `Decimal`, never a JS float.
 * - Currency is QAR with 2 decimal places.
 * - Rounding is explicit. `half_up` is the default. `half_even` (banker's rounding) is used
 *   only where a rule pack parameter says so.
 */

/** Isolated Decimal constructor so global Decimal config elsewhere cannot affect money maths. */
export const MoneyDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 40,
});
export type Dec = Decimal;

export type RoundingMode = "half_up" | "half_even";
export const CURRENCY = "QAR" as const;
export const MONEY_DP = 2;

const ROUNDING: Record<RoundingMode, Decimal.Rounding> = {
  half_up: Decimal.ROUND_HALF_UP,
  half_even: Decimal.ROUND_HALF_EVEN,
};

/**
 * Build a Decimal. Accepts decimal strings, Decimals and *integer* numbers only: a non-integer
 * JS number has already lost precision, so it is rejected loudly instead of silently used.
 */
export function D(value: Decimal.Value | Decimal): Decimal {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new TypeError(
      `Money is decimal: pass a string instead of the float ${String(value)} (non-negotiable 10)`,
    );
  }
  if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(value.trim())) {
    throw new TypeError(`Not a plain decimal string: "${value}"`);
  }
  return new MoneyDecimal(value);
}

/** Round to `dp` places (default 2) with an explicit mode (default half-up). */
export function round(value: Decimal, mode: RoundingMode = "half_up", dp = MONEY_DP): Decimal {
  return value.toDecimalPlaces(dp, ROUNDING[mode]);
}

/** Canonical money string with exactly 2 dp, e.g. "420.00". Used for facts and storage. */
export function toMoneyString(value: Decimal, mode: RoundingMode = "half_up"): string {
  // eslint-disable-next-line no-restricted-properties -- Decimal#toFixed is exact, not a float op
  return value.toFixed(MONEY_DP, ROUNDING[mode]);
}

/** Fixed-dp string for any decimal quantity (rates, point values). */
export function toFixedString(value: Decimal, dp: number, mode: RoundingMode = "half_up"): string {
  // eslint-disable-next-line no-restricted-properties -- Decimal#toFixed is exact, not a float op
  return value.toFixed(dp, ROUNDING[mode]);
}

export function sum(values: readonly Decimal[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), D(0));
}

export function min(first: Decimal, ...rest: Decimal[]): Decimal {
  return rest.reduce((m, v) => (v.lessThan(m) ? v : m), first);
}

export function max(first: Decimal, ...rest: Decimal[]): Decimal {
  return rest.reduce((m, v) => (v.greaterThan(m) ? v : m), first);
}

/** Clamp between floor and cap (either may be omitted). */
export function clamp(value: Decimal, floor?: Decimal, cap?: Decimal): Decimal {
  let v = value;
  if (floor && v.lessThan(floor)) v = floor;
  if (cap && v.greaterThan(cap)) v = cap;
  return v;
}

/** `pct` percent of `amount` (unrounded). percentOf(D("1000"), D("2.5")) = 25. */
export function percentOf(amount: Decimal, pct: Decimal): Decimal {
  return amount.times(pct).dividedBy(100);
}

/** amount × numerator / denominator (unrounded). Throws on a zero denominator. */
export function proRata(amount: Decimal, numerator: Decimal, denominator: Decimal): Decimal {
  if (denominator.isZero()) throw new RangeError("proRata: denominator is zero");
  return amount.times(numerator).dividedBy(denominator);
}
