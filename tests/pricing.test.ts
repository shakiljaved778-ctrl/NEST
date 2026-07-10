import { describe, expect, it } from "vitest";
import { buildQuote, COUPONS, isPeakSlot } from "../lib/pricing";

describe("isPeakSlot", () => {
  it("treats 17:00–20:59 as peak", () => {
    expect(isPeakSlot("17:00")).toBe(true);
    expect(isPeakSlot("19:30")).toBe(true);
    expect(isPeakSlot("20:59")).toBe(true);
  });

  it("treats off-peak and missing slots as non-peak", () => {
    expect(isPeakSlot("16:59")).toBe(false);
    expect(isPeakSlot("21:00")).toBe(false);
    expect(isPeakSlot("09:00")).toBe(false);
    expect(isPeakSlot(undefined)).toBe(false);
  });
});

describe("buildQuote", () => {
  const base = { serviceId: "house-cleaning", packageId: "hc-2h" }; // QAR 79

  it("prices a bare package with no surcharges or discounts", () => {
    const q = buildQuote({ ...base, slot: "10:00" });
    expect(q.subtotal).toBe(79);
    expect(q.surcharge).toBe(0);
    expect(q.discount).toBe(0);
    expect(q.total).toBe(79);
    expect(q.currency).toBe("QAR");
    expect(q.peak).toBe(false);
  });

  it("adds add-on line items to the subtotal", () => {
    // fridge 35 + oven 40 on top of 79
    const q = buildQuote({ ...base, addonIds: ["hc-fridge", "hc-oven"], slot: "10:00" });
    expect(q.lines).toHaveLength(3);
    expect(q.subtotal).toBe(154);
    expect(q.total).toBe(154);
  });

  it("silently ignores unknown add-on ids", () => {
    const q = buildQuote({ ...base, addonIds: ["not-a-real-addon"], slot: "10:00" });
    expect(q.lines).toHaveLength(1);
    expect(q.subtotal).toBe(79);
  });

  it("applies the 10% peak-hour uplift on evening slots", () => {
    const q = buildQuote({ ...base, slot: "18:00" });
    expect(q.peak).toBe(true);
    expect(q.surcharge).toBe(Math.round(79 * 0.1));
    expect(q.total).toBe(79 + 8);
  });

  it("adds the QAR 30 urgency fee, stacking with peak uplift", () => {
    const q = buildQuote({ ...base, slot: "18:00", urgent: true });
    expect(q.surcharge).toBe(8 + 30);
    expect(q.total).toBe(79 + 38);
  });

  it("applies percent coupons on the subtotal only (not surcharges)", () => {
    const q = buildQuote({ ...base, slot: "18:00", couponCode: "NEST10" });
    expect(q.discount).toBe(Math.round((79 * 10) / 100));
    expect(q.total).toBe(79 + 8 - 8);
  });

  it("applies fixed coupons and is case/whitespace-insensitive", () => {
    const q = buildQuote({ ...base, slot: "10:00", couponCode: "  pearl25 " });
    expect(q.discount).toBe(25);
    expect(q.total).toBe(54);
  });

  it("ignores unknown coupon codes", () => {
    const q = buildQuote({ ...base, slot: "10:00", couponCode: "BOGUS" });
    expect(q.discount).toBe(0);
  });

  it("stacks the Nest+ subscriber discount with a coupon", () => {
    const q = buildQuote({ ...base, slot: "10:00", couponCode: "SALAM15", nestPlus: true });
    // 15% + 10% of 79 → 12 + 8
    expect(q.discount).toBe(Math.round((79 * 15) / 100) + Math.round(79 * 0.1));
  });

  it("never discounts below the subtotal (total cannot go negative)", () => {
    // cheapest real package with a large fixed coupon
    const q = buildQuote({ serviceId: "house-cleaning", packageId: "hc-2h", couponCode: "PEARL25", nestPlus: true });
    expect(q.discount).toBeLessThanOrEqual(q.subtotal);
    expect(q.total).toBeGreaterThanOrEqual(0);
  });

  it("throws on unknown service or package", () => {
    expect(() => buildQuote({ serviceId: "nope", packageId: "hc-2h" })).toThrow(/Unknown service/);
    expect(() => buildQuote({ serviceId: "house-cleaning", packageId: "nope" })).toThrow(/Unknown package/);
  });

  it("exposes the three launch coupons", () => {
    expect(Object.keys(COUPONS).sort()).toEqual(["NEST10", "PEARL25", "SALAM15"]);
  });
});
