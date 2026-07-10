import { beforeEach, describe, expect, it } from "vitest";
import {
  capturePayment,
  captureForBooking,
  commissionRateFor,
  computeSplit,
  confirmPayment,
  createPaymentIntent,
  createRefund,
  getPayment,
  listPayments,
  VAT_RATE,
} from "../lib/payments";
import { createBooking } from "../lib/store";
import { buildQuote } from "../lib/pricing";

beforeEach(() => {
  globalThis.__nestBookings = undefined;
  globalThis.__nestPayments = undefined;
  globalThis.__nestRefunds = undefined;
});

function makeBooking(serviceId = "house-cleaning", packageId = "hc-2h") {
  return createBooking({
    serviceId,
    packageId,
    addonIds: [],
    zoneId: "west-bay",
    address: "Zone 61, Street 850, Building 9",
    date: new Date().toISOString().slice(0, 10),
    slot: "10:00",
    urgent: false,
    paymentMethod: "card",
    quote: buildQuote({ serviceId, packageId, slot: "10:00" }),
    providerId: "p2",
    customerName: "Pay Tester",
    language: "en",
  });
}

describe("commission split", () => {
  it("uses tiered rates by category", () => {
    expect(commissionRateFor("house-cleaning")).toBe(0.2); // cleaning
    expect(commissionRateFor("ac-technician")).toBe(0.15); // technical
    expect(commissionRateFor("salon")).toBe(0.25); // salon-at-home
    expect(commissionRateFor("nanny")).toBe(0.12); // care service-fee model
    expect(commissionRateFor("unknown-service")).toBe(0.2); // default
  });

  it("splits gross into VAT, commission and provider net that reconcile", () => {
    const s = computeSplit("house-cleaning", 100);
    expect(s.vat).toBe(100 * VAT_RATE);
    expect(s.commission).toBe(20);
    expect(s.providerNet).toBe(80);
    expect(s.vat + s.commission + s.providerNet).toBeCloseTo(s.gross, 2);
  });
});

describe("payment lifecycle", () => {
  it("creates an intent from the booking quote", () => {
    const b = makeBooking();
    const p = createPaymentIntent(b.id);
    expect(p.status).toBe("requires_confirmation");
    expect(p.amount).toBe(b.quote.total);
    expect(p.split.providerNet).toBeLessThan(p.amount);
  });

  it("is idempotent per booking", () => {
    const b = makeBooking();
    const p1 = createPaymentIntent(b.id);
    const p2 = createPaymentIntent(b.id);
    expect(p2.id).toBe(p1.id);
    expect(listPayments()).toHaveLength(1);
  });

  it("rejects intents for unknown bookings", () => {
    expect(() => createPaymentIntent("NB-nope")).toThrow(/Unknown booking/);
  });

  it("walks pre-auth → capture and issues a VAT-ready e-invoice", () => {
    const b = makeBooking();
    const p = createPaymentIntent(b.id);
    expect(confirmPayment(p.id).status).toBe("authorized");
    const captured = capturePayment(p.id);
    expect(captured.status).toBe("captured");
    expect(captured.invoice).toBeDefined();
    expect(captured.invoice!.number).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(captured.invoice!.total).toBe(p.amount);
    expect(captured.invoice!.vatRate).toBe(VAT_RATE);
    expect(captured.invoice!.currency).toBe("QAR");
  });

  it("enforces state transitions (no capture before confirm, no double confirm)", () => {
    const b = makeBooking();
    const p = createPaymentIntent(b.id);
    expect(() => capturePayment(p.id)).toThrow(/Cannot capture/);
    confirmPayment(p.id);
    expect(() => confirmPayment(p.id)).toThrow(/Cannot confirm/);
  });

  it("captures automatically for a booking via captureForBooking", () => {
    const b = makeBooking();
    const p = createPaymentIntent(b.id);
    confirmPayment(p.id);
    const captured = captureForBooking(b.id);
    expect(captured?.status).toBe("captured");
    expect(captureForBooking(b.id)).toBeUndefined(); // nothing left to capture
  });
});

describe("refunds", () => {
  function capturedPayment() {
    const b = makeBooking();
    const p = createPaymentIntent(b.id);
    confirmPayment(p.id);
    return capturePayment(p.id);
  }

  it("supports partial then full refunds with status transitions", () => {
    const p = capturedPayment(); // QAR 79
    const r1 = createRefund(p.id, 30, "late arrival compensation");
    expect(r1.id).toMatch(/^RF-\d+$/);
    expect(getPayment(p.id)!.status).toBe("partially_refunded");
    createRefund(p.id, 49, "quality issue");
    expect(getPayment(p.id)!.status).toBe("refunded");
    expect(getPayment(p.id)!.refundedAmount).toBe(79);
  });

  it("rejects over-refunds and non-positive amounts", () => {
    const p = capturedPayment();
    expect(() => createRefund(p.id, p.amount + 1, "too much")).toThrow(/exceeds refundable/);
    expect(() => createRefund(p.id, 0, "zero")).toThrow(/positive/);
  });

  it("rejects refunds on uncaptured payments", () => {
    const b = makeBooking();
    const p = createPaymentIntent(b.id);
    expect(() => createRefund(p.id, 10, "not captured yet")).toThrow(/Cannot refund/);
  });
});
