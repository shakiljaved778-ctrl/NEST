import type { Booking } from "./types";
import type { Payment, Refund } from "./payments";

/**
 * AI fraud detection (blueprint module 7) — rule-based MVP.
 *
 * Production adds device fingerprinting, graph features (collusion rings) and
 * a learned risk model; these rules remain as the explainable first layer.
 * Flags feed the admin fraud monitor and the ops review queue.
 */

export type FraudType = "coupon_abuse" | "refund_abuse" | "fake_bookings" | "rating_manipulation";

export interface FraudFlag {
  id: string;
  type: FraudType;
  entity: string; // customer name / provider id
  score: number; // 0–1 risk
  signal: string;
  suggestedAction: string;
}

export interface FraudInput {
  bookings: Booking[];
  payments?: Payment[];
  refunds?: Refund[];
}

const COUPON_REUSE_THRESHOLD = 3; // same customer + same coupon
const CANCEL_RATIO_THRESHOLD = 0.5; // half of a customer's bookings cancelled
const REFUND_COUNT_THRESHOLD = 3; // refunds per customer in the window
const RATING_BURST_THRESHOLD = 4; // 5★ jobs for one provider from one customer

export function detectFraud(input: FraudInput): FraudFlag[] {
  const flags: FraudFlag[] = [];
  let seq = 0;
  const flag = (type: FraudType, entity: string, score: number, signal: string, suggestedAction: string) => {
    seq += 1;
    flags.push({ id: `F-${seq}`, type, entity, score: Math.round(score * 100) / 100, signal, suggestedAction });
  };

  const active = input.bookings.filter((b) => b.status !== "cancelled");

  // 1. Coupon abuse: the same customer re-using the same coupon code.
  const couponUse = new Map<string, number>();
  for (const b of active) {
    if (!b.couponCode) continue;
    const key = `${b.customerName}|${b.couponCode.toUpperCase()}`;
    couponUse.set(key, (couponUse.get(key) ?? 0) + 1);
  }
  for (const [key, count] of couponUse) {
    if (count >= COUPON_REUSE_THRESHOLD) {
      const [customer, coupon] = key.split("|");
      flag(
        "coupon_abuse",
        customer,
        Math.min(1, 0.5 + count * 0.1),
        `${coupon} used ${count}× by the same customer`,
        "Block coupon for this account",
      );
    }
  }

  // 2. Fake bookings: heavy cancellation ratios per customer.
  const byCustomer = new Map<string, { total: number; cancelled: number }>();
  for (const b of input.bookings) {
    const c = byCustomer.get(b.customerName) ?? { total: 0, cancelled: 0 };
    c.total += 1;
    if (b.status === "cancelled") c.cancelled += 1;
    byCustomer.set(b.customerName, c);
  }
  for (const [customer, c] of byCustomer) {
    if (c.total >= 4 && c.cancelled / c.total >= CANCEL_RATIO_THRESHOLD) {
      flag(
        "fake_bookings",
        customer,
        Math.min(1, c.cancelled / c.total),
        `${c.cancelled} of ${c.total} bookings cancelled`,
        "Require prepayment for next booking",
      );
    }
  }

  // 3. Refund abuse: repeat refund claims by one customer.
  if (input.refunds && input.payments) {
    const paymentBooking = new Map(input.payments.map((p) => [p.id, p.bookingId]));
    const bookingCustomer = new Map(input.bookings.map((b) => [b.id, b.customerName]));
    const refundsByCustomer = new Map<string, number>();
    for (const r of input.refunds) {
      const customer = bookingCustomer.get(paymentBooking.get(r.paymentId) ?? "");
      if (!customer) continue;
      refundsByCustomer.set(customer, (refundsByCustomer.get(customer) ?? 0) + 1);
    }
    for (const [customer, count] of refundsByCustomer) {
      if (count >= REFUND_COUNT_THRESHOLD) {
        flag(
          "refund_abuse",
          customer,
          Math.min(1, 0.4 + count * 0.1),
          `${count} refund claims in the review window`,
          "Manual review before next refund",
        );
      }
    }
  }

  // 4. Rating manipulation: bursts of 5★ ratings for one provider from one customer.
  const ratingPairs = new Map<string, number>();
  for (const b of active) {
    if (b.rating === 5 && b.providerId) {
      const key = `${b.providerId}|${b.customerName}`;
      ratingPairs.set(key, (ratingPairs.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of ratingPairs) {
    if (count >= RATING_BURST_THRESHOLD) {
      const [providerId] = key.split("|");
      flag(
        "rating_manipulation",
        providerId,
        Math.min(1, 0.4 + count * 0.08),
        `${count} five-star ratings from a single customer`,
        "Exclude pair from rating; review provider",
      );
    }
  }

  return flags.sort((a, b) => b.score - a.score);
}
