import { z } from "zod";

/**
 * Money is ALWAYS integer minor units (cents / fils) + an ISO-4217 code.
 * No floats in the ledger, ever. This module is the only sanctioned way
 * to construct and combine money in Voyara.
 */
export const CurrencyCode = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "ISO-4217 currency code, e.g. USD, AED");
export type CurrencyCode = z.infer<typeof CurrencyCode>;

export const Money = z.object({
  /** Integer minor units. Never a float. */
  amountMinor: z.number().int(),
  currency: CurrencyCode,
});
export type Money = z.infer<typeof Money>;

export function money(amountMinor: number, currency: string): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Money must be integer minor units, got ${amountMinor}`);
  }
  return Money.parse({ amountMinor, currency });
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/** Multiply money by an integer basis-points factor, rounding half-up. */
export function bpsOf(m: Money, basisPoints: number): Money {
  const raw = (m.amountMinor * basisPoints) / 10_000;
  return money(Math.round(raw), m.currency);
}

export function formatMoney(m: Money): string {
  const major = (m.amountMinor / 100).toFixed(2);
  return `${m.currency} ${major}`;
}
