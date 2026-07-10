import { getBooking } from "./store";
import { getService } from "./catalog";

/**
 * NEST payments & money engine (MVP — mock PSP).
 *
 * Mirrors the production flow through a Qatar-licensed PSP
 * (QPay / SkipCash / Tap / bank gateway):
 *
 *   intent (requires_confirmation)
 *     → confirm = pre-authorization (authorized; funds held, nothing charged)
 *     → capture on booking completion (captured; commission split + e-invoice)
 *     → partial / full refunds against the captured amount
 *
 * No PAN ever touches this service — production stores only the PSP token.
 * VAT-ready: the invoice carries a VAT line at VAT_RATE (0% until Qatar's 5%
 * VAT lands H2-2026; flip the constant, invoices are already compliant).
 */

export type PaymentStatus = "requires_confirmation" | "authorized" | "captured" | "refunded" | "partially_refunded" | "cancelled";
export type PaymentMethod = "card" | "apple_pay" | "google_pay" | "wallet";

/** VAT rate — 0 until Qatar introduces 5% VAT (expected H2-2026). */
export const VAT_RATE = 0;

/** Commission tiers by category from the business model (blended pilot rates). */
export const COMMISSION_RATES: Record<string, { category: string; rate: number }> = {
  "house-cleaning": { category: "cleaning", rate: 0.2 },
  "deep-cleaning": { category: "cleaning", rate: 0.2 },
  laundry: { category: "cleaning", rate: 0.18 },
  plumbing: { category: "technical", rate: 0.15 },
  "ac-technician": { category: "technical", rate: 0.15 },
  electrical: { category: "technical", rate: 0.15 },
  "appliance-repair": { category: "technical", rate: 0.15 },
  handyman: { category: "technical", rate: 0.15 },
  "pest-control": { category: "technical", rate: 0.15 },
  salon: { category: "salon-at-home", rate: 0.25 },
  nanny: { category: "care", rate: 0.12 }, // care runs on a service-fee model
  "elderly-care": { category: "care", rate: 0.12 },
  cooking: { category: "care", rate: 0.15 },
  moving: { category: "technical", rate: 0.15 },
  "car-wash": { category: "cleaning", rate: 0.2 },
};

const DEFAULT_RATE = 0.2;

export interface PaymentSplit {
  /** Gross amount charged to the customer (QAR). */
  gross: number;
  /** VAT portion of gross (0 until VAT lands). */
  vat: number;
  /** Nest commission on the net amount. */
  commission: number;
  commissionRate: number;
  /** Provider payout after commission. */
  providerNet: number;
}

export interface Invoice {
  number: string; // e.g. INV-2026-000123
  issuedAt: string;
  currency: "QAR";
  lines: { label: string; amount: number }[];
  vatRate: number;
  vatAmount: number;
  total: number;
}

export interface Payment {
  id: string; // PAY-xxxx
  bookingId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number; // QAR, gross
  refundedAmount: number;
  split: PaymentSplit;
  invoice?: Invoice; // issued at capture
  createdAt: string;
  capturedAt?: string;
}

export interface Refund {
  id: string; // RF-xxxx
  paymentId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __nestPayments: Payment[] | undefined;
  // eslint-disable-next-line no-var
  var __nestRefunds: Refund[] | undefined;
}

function payments(): Payment[] {
  if (!globalThis.__nestPayments) globalThis.__nestPayments = [];
  return globalThis.__nestPayments;
}

function refunds(): Refund[] {
  if (!globalThis.__nestRefunds) globalThis.__nestRefunds = [];
  return globalThis.__nestRefunds;
}

export function commissionRateFor(serviceId: string): number {
  return COMMISSION_RATES[serviceId]?.rate ?? DEFAULT_RATE;
}

export function computeSplit(serviceId: string, gross: number): PaymentSplit {
  const rate = commissionRateFor(serviceId);
  const vat = Math.round(gross * VAT_RATE * 100) / 100;
  const net = gross - vat;
  const commission = Math.round(net * rate * 100) / 100;
  return {
    gross,
    vat,
    commission,
    commissionRate: rate,
    providerNet: Math.round((net - commission) * 100) / 100,
  };
}

export function createPaymentIntent(bookingId: string, method: PaymentMethod = "card"): Payment {
  const booking = getBooking(bookingId);
  if (!booking) throw new Error(`Unknown booking: ${bookingId}`);
  const existing = payments().find((p) => p.bookingId === bookingId && p.status !== "cancelled");
  if (existing) return existing; // idempotent per booking

  const payment: Payment = {
    id: `PAY-${1000 + payments().length}`,
    bookingId,
    method,
    status: "requires_confirmation",
    amount: booking.quote.total,
    refundedAmount: 0,
    split: computeSplit(booking.serviceId, booking.quote.total),
    createdAt: new Date().toISOString(),
  };
  payments().push(payment);
  return payment;
}

/** Confirm = pre-authorization: funds held, nothing charged until completion. */
export function confirmPayment(paymentId: string): Payment {
  const p = payments().find((x) => x.id === paymentId);
  if (!p) throw new Error(`Unknown payment: ${paymentId}`);
  if (p.status !== "requires_confirmation") throw new Error(`Cannot confirm payment in status ${p.status}`);
  p.status = "authorized";
  return p;
}

let invoiceSeq = 0;

function issueInvoice(p: Payment): Invoice {
  const booking = getBooking(p.bookingId);
  const service = booking ? getService(booking.serviceId) : undefined;
  invoiceSeq += 1;
  const vatAmount = p.split.vat;
  return {
    number: `INV-${new Date().getFullYear()}-${String(invoiceSeq).padStart(6, "0")}`,
    issuedAt: new Date().toISOString(),
    currency: "QAR",
    lines: booking?.quote.lines ?? [{ label: service?.name ?? "Service", amount: p.amount }],
    vatRate: VAT_RATE,
    vatAmount,
    total: p.amount,
  };
}

/** Capture on completion: charge the held funds, split, and issue the e-invoice. */
export function capturePayment(paymentId: string): Payment {
  const p = payments().find((x) => x.id === paymentId);
  if (!p) throw new Error(`Unknown payment: ${paymentId}`);
  if (p.status !== "authorized") throw new Error(`Cannot capture payment in status ${p.status}`);
  p.status = "captured";
  p.capturedAt = new Date().toISOString();
  p.invoice = issueInvoice(p);
  return p;
}

/** Capture the booking's authorized payment when the job completes (no-op if none). */
export function captureForBooking(bookingId: string): Payment | undefined {
  const p = payments().find((x) => x.bookingId === bookingId && x.status === "authorized");
  return p ? capturePayment(p.id) : undefined;
}

export function createRefund(paymentId: string, amount: number, reason: string): Refund {
  const p = payments().find((x) => x.id === paymentId);
  if (!p) throw new Error(`Unknown payment: ${paymentId}`);
  if (p.status !== "captured" && p.status !== "partially_refunded") {
    throw new Error(`Cannot refund payment in status ${p.status}`);
  }
  if (amount <= 0) throw new Error("Refund amount must be positive");
  const refundable = p.amount - p.refundedAmount;
  if (amount > refundable) throw new Error(`Refund exceeds refundable amount (QAR ${refundable})`);

  const refund: Refund = {
    id: `RF-${100 + refunds().length}`,
    paymentId,
    amount,
    reason,
    createdAt: new Date().toISOString(),
  };
  refunds().push(refund);
  p.refundedAmount += amount;
  p.status = p.refundedAmount >= p.amount ? "refunded" : "partially_refunded";
  return refund;
}

export function getPayment(id: string): Payment | undefined {
  return payments().find((p) => p.id === id);
}

export function listPayments(): Payment[] {
  return [...payments()].reverse();
}

export function listRefunds(): Refund[] {
  return [...refunds()].reverse();
}
