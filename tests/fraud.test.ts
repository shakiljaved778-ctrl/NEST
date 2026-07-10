import { describe, expect, it } from "vitest";
import { detectFraud } from "../lib/fraud";
import { buildQuote } from "../lib/pricing";
import type { Booking } from "../lib/types";

let seq = 0;

function booking(overrides: Partial<Booking>): Booking {
  seq += 1;
  return {
    id: `NB-T${seq}`,
    serviceId: "house-cleaning",
    packageId: "hc-2h",
    addonIds: [],
    zoneId: "west-bay",
    address: "Test",
    date: "2026-07-10",
    slot: "10:00",
    urgent: false,
    paymentMethod: "card",
    quote: buildQuote({ serviceId: "house-cleaning", packageId: "hc-2h" }),
    status: "completed",
    customerName: "Normal Customer",
    language: "en",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("detectFraud", () => {
  it("returns no flags for a healthy marketplace", () => {
    const bookings = [
      booking({ customerName: "A", couponCode: "NEST10" }),
      booking({ customerName: "B" }),
      booking({ customerName: "C", status: "cancelled" }),
    ];
    expect(detectFraud({ bookings })).toEqual([]);
  });

  it("flags coupon reuse by the same customer", () => {
    const bookings = [1, 2, 3].map(() => booking({ customerName: "Abuser", couponCode: "nest10" }));
    const flags = detectFraud({ bookings });
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe("coupon_abuse");
    expect(flags[0].entity).toBe("Abuser");
    expect(flags[0].signal).toContain("NEST10");
  });

  it("flags heavy cancellation ratios as fake bookings", () => {
    const bookings = [
      booking({ customerName: "Ghost", status: "cancelled" }),
      booking({ customerName: "Ghost", status: "cancelled" }),
      booking({ customerName: "Ghost", status: "cancelled" }),
      booking({ customerName: "Ghost", status: "completed" }),
    ];
    const flags = detectFraud({ bookings });
    expect(flags.some((f) => f.type === "fake_bookings" && f.entity === "Ghost")).toBe(true);
  });

  it("flags rating bursts for one provider from one customer", () => {
    const bookings = [1, 2, 3, 4].map(() =>
      booking({ customerName: "Shill", providerId: "p9", rating: 5 }),
    );
    const flags = detectFraud({ bookings });
    expect(flags.some((f) => f.type === "rating_manipulation" && f.entity === "p9")).toBe(true);
  });

  it("sorts flags by descending risk score", () => {
    const bookings = [
      ...[1, 2, 3, 4, 5].map(() => booking({ customerName: "Abuser", couponCode: "NEST10" })),
      ...[1, 2, 3, 4].map(() => booking({ customerName: "Shill", providerId: "p9", rating: 5 })),
    ];
    const flags = detectFraud({ bookings });
    expect(flags.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < flags.length; i++) {
      expect(flags[i - 1].score).toBeGreaterThanOrEqual(flags[i].score);
    }
  });
});
