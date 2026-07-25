import { describe, it, expect } from "vitest";
import { HeuristicForecastEngine } from "./engine.js";
import type { NormalizedOffer } from "@voyara/contracts";

function offer(id: string, amountMinor: number): NormalizedOffer {
  return {
    id,
    kind: "HOTEL",
    supplierRef: `mock:${id}`,
    title: "Test Hotel",
    city: "Istanbul",
    neighborhood: "Sultanahmet",
    lat: null,
    lng: null,
    price: { amountMinor, currency: "USD" },
    perNight: { amountMinor: Math.round(amountMinor / 3), currency: "USD" },
    refundable: true,
    cancellation: [],
    holdable: true,
    holdTtlSeconds: 600,
    rating: 4.5,
    reviewCount: 200,
    style: ["boutique"],
    amenities: [],
    distanceToAnchorKm: 0.4,
    scheduleQuality: null,
    offerPayload: {},
  };
}

describe("HeuristicForecastEngine", () => {
  const engine = new HeuristicForecastEngine();

  it("returns a 14-point forward curve and a valid verdict", () => {
    const r = engine.forecast(offer("h1", 42000), { daysToDeparture: 20 });
    expect(r.curve).toHaveLength(14);
    expect(["BUY", "WAIT"]).toContain(r.verdict);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("favors BUY when there is little runway", () => {
    const r = engine.forecast(offer("h2", 42000), { daysToDeparture: 2 });
    expect(r.verdict).toBe("BUY");
  });

  it("freeze fee never exceeds the exposure cap (15% default)", () => {
    for (const id of ["a", "b", "c", "highvol-zzz", "q9"]) {
      const o = offer(id, 100000);
      const q = engine.quoteFreeze(o, { daysToDeparture: 60, freezeWindowHours: 48 });
      expect(q.fee.amountMinor).toBeLessThanOrEqual(q.exposureCap.amountMinor);
      // exposure cap itself is bounded to <=15% of fare by default
      expect(q.exposureCap.amountMinor).toBeLessThanOrEqual(15000);
    }
  });

  it("respects a lower per-fare-class exposure cap when configured", () => {
    const q = engine.quoteFreeze(offer("x", 100000), {
      daysToDeparture: 90,
      exposureCapFraction: 0.05,
      freezeWindowHours: 72,
    });
    expect(q.exposureCap.amountMinor).toBeLessThanOrEqual(5000);
    expect(q.fee.amountMinor).toBeLessThanOrEqual(5000);
  });
});
