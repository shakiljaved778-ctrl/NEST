import { getService } from "./catalog";
import type { Quote, QuoteLine } from "./types";

/**
 * NEST pricing engine (MVP rules — the production engine adds demand-based
 * dynamic pricing per zone from booking telemetry).
 *
 * total = package + add-ons
 *       + peak-hour uplift (evening slots 17:00–21:00: +10%)
 *       + urgency surcharge (within 2 hours: +QAR 30)
 *       - coupon discount
 *       - Nest+ subscriber discount (10%)
 */

export const COUPONS: Record<string, { type: "percent" | "fixed"; value: number; label: string }> = {
  NEST10: { type: "percent", value: 10, label: "10% off — welcome offer" },
  PEARL25: { type: "fixed", value: 25, label: "QAR 25 off — The Pearl launch" },
  SALAM15: { type: "percent", value: 15, label: "15% off — first booking" },
};

export interface QuoteInput {
  serviceId: string;
  packageId: string;
  addonIds?: string[];
  slot?: string; // "HH:MM"
  urgent?: boolean;
  couponCode?: string;
  nestPlus?: boolean;
}

const PEAK_START = 17;
const PEAK_END = 21;
const PEAK_UPLIFT = 0.1;
const URGENT_FEE = 30;

export function isPeakSlot(slot?: string): boolean {
  if (!slot) return false;
  const hour = Number(slot.split(":")[0]);
  return hour >= PEAK_START && hour < PEAK_END;
}

export function buildQuote(input: QuoteInput): Quote {
  const service = getService(input.serviceId);
  if (!service) throw new Error(`Unknown service: ${input.serviceId}`);
  const pkg = service.packages.find((p) => p.id === input.packageId);
  if (!pkg) throw new Error(`Unknown package: ${input.packageId}`);

  const lines: QuoteLine[] = [{ label: pkg.name, amount: pkg.price }];

  for (const addonId of input.addonIds ?? []) {
    const addon = service.addons.find((a) => a.id === addonId);
    if (addon) lines.push({ label: addon.name, amount: addon.price });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);

  let surcharge = 0;
  const peak = isPeakSlot(input.slot);
  if (peak) surcharge += Math.round(subtotal * PEAK_UPLIFT);
  if (input.urgent) surcharge += URGENT_FEE;

  let discount = 0;
  const coupon = input.couponCode ? COUPONS[input.couponCode.trim().toUpperCase()] : undefined;
  if (coupon) {
    discount += coupon.type === "percent" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  }
  if (input.nestPlus) discount += Math.round(subtotal * 0.1);
  discount = Math.min(discount, subtotal); // never go negative

  const total = subtotal + surcharge - discount;

  return {
    lines,
    subtotal,
    surcharge,
    discount,
    total,
    currency: "QAR",
    slotLabel: input.slot ?? "",
    peak,
  };
}
