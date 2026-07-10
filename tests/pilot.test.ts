import { beforeEach, describe, expect, it } from "vitest";
import { PILOT_LENGTH_DAYS, pilotScoreboard } from "../lib/pilot";

beforeEach(() => {
  globalThis.__nestBookings = undefined;
});

describe("pilotScoreboard", () => {
  it("tracks the five Seed-readiness gates from the business plan", () => {
    const s = pilotScoreboard();
    expect(s.gates.map((g) => g.id)).toEqual(["providers", "zones", "bookings", "repeat", "gmv"]);
  });

  it("keeps the pilot clock inside the 90-day window", () => {
    const s = pilotScoreboard();
    expect(s.day).toBeGreaterThan(0);
    expect(s.day).toBeLessThanOrEqual(PILOT_LENGTH_DAYS);
    expect(s.day + s.daysRemaining).toBe(PILOT_LENGTH_DAYS);
  });

  it("marks the provider gate achieved once 40+ verified pros are live", () => {
    const providers = pilotScoreboard().gates.find((g) => g.id === "providers")!;
    expect(providers.current).toBeGreaterThanOrEqual(40);
    expect(providers.status).toBe("achieved");
    expect(providers.targetMax).toBe(60);
  });

  it("activates both beachhead zones from seeded bookings", () => {
    const zones = pilotScoreboard().gates.find((g) => g.id === "zones")!;
    expect(zones.current).toBeGreaterThanOrEqual(2);
    expect(zones.status).toBe("achieved");
  });

  it("expresses repeat rate as a percentage against the 40% gate", () => {
    const repeat = pilotScoreboard().gates.find((g) => g.id === "repeat")!;
    expect(repeat.unit).toBe("percent");
    expect(repeat.current).toBeGreaterThan(0);
    expect(repeat.current).toBeLessThanOrEqual(100);
    expect(repeat.target).toBe(40);
  });

  it("extrapolates GMV run-rate to the full 90 days", () => {
    const gmv = pilotScoreboard().gates.find((g) => g.id === "gmv")!;
    expect(gmv.unit).toBe("qar");
    expect(gmv.target).toBe(500_000);
    expect(gmv.current).toBeGreaterThan(0);
  });

  it("only reports seedReady when every gate is achieved", () => {
    const s = pilotScoreboard();
    expect(s.seedReady).toBe(s.gates.every((g) => g.status === "achieved"));
  });

  it("assigns a valid status to every gate", () => {
    for (const g of pilotScoreboard().gates) {
      expect(["achieved", "on_track", "at_risk"]).toContain(g.status);
    }
  });
});
