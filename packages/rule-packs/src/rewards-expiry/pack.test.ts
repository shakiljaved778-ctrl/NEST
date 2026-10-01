import { describe, expect, it } from "vitest";
import { NOW, rewardsExpiry, thresholds } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateRewardsExpiry, RewardsExpiryParamsSchema } from "./pack";

const params = PACKS["rewards.expiry"].conventional.defaultParameters;

describe("rewards.expiry", () => {
  it("worked example: Khalid, 8,000 points expiring in 45 days", () => {
    // 30 days: 0; 60 and 90 days: 8,000 points × 0.01 = 80.00; next expiry 2026-11-14 (45 days)
    const ev = evaluateRewardsExpiry(rewardsExpiry(), params, thresholds, NOW);
    const v = Object.fromEntries(
      Object.entries(ev.facts)
        .filter(([k]) => k !== "_sources")
        .map(([k, f]) => [k, (f as { value: string }).value]),
    );
    expect(v).toEqual({
      pointsBalance: "42000",
      pointsValue: "420.00",
      shortWindowDays: "30",
      pointsExpiringShort: "0",
      pointsExpiringShortValue: "0.00",
      midWindowDays: "60",
      pointsExpiringMid: "8000",
      pointsExpiringMidValue: "80.00",
      longWindowDays: "90",
      pointsExpiringLong: "8000",
      pointsExpiringLongValue: "80.00",
      nextExpiryDate: "2026-11-14",
      nextExpiryPoints: "8000",
      nextExpiryValue: "80.00",
      daysUntilNextExpiry: "45",
    });
    expect([ev.applicable, ev.severity]).toEqual([true, "caution"]);
    expect(ev.options).toEqual(["redeem_points", "talk_to_someone"]);
    expect(ev.explanation[0]).toBe("points_expiring_within_90_days");
  });

  it("windows are cumulative and same-day buckets add up; past and empty buckets are ignored", () => {
    const ev = evaluateRewardsExpiry(
      rewardsExpiry({
        balance: 40000,
        expiryBuckets: [
          { points: 5000, expiresAt: "2026-09-01" },
          { points: 0, expiresAt: "2026-10-02" },
          { points: 10000, expiresAt: "2026-10-10" },
          { points: 15000, expiresAt: "2026-10-10" },
          { points: 6000, expiresAt: "2026-12-20" },
        ],
      }),
      params,
      thresholds,
      NOW,
    );
    expect([
      ev.facts.pointsExpiringShort.value,
      ev.facts.pointsExpiringMid.value,
      ev.facts.pointsExpiringLong.value,
      ev.facts.nextExpiryPoints.value,
      ev.facts.pointsExpiringLongValue.value,
      ev.severity,
    ]).toEqual(["25000", "25000", "31000", "25000", "310.00", "critical"]);
  });

  it("is not applicable with nothing expiring within the widest window, or on a closed card", () => {
    const later = rewardsExpiry({ expiryBuckets: [{ points: 42000, expiresAt: "2027-11-04" }] });
    const ev = evaluateRewardsExpiry(later, params, thresholds, NOW);
    expect(ev.applicable).toBe(false);
    const none = evaluateRewardsExpiry(
      rewardsExpiry({ expiryBuckets: [] }),
      params,
      thresholds,
      NOW,
    );
    expect([none.facts.nextExpiryDate.value, none.facts.daysUntilNextExpiry.value]).toEqual([
      "",
      "0",
    ]);
    const closed = rewardsExpiry();
    closed.card.status = "closed";
    expect(evaluateRewardsExpiry(closed, params, thresholds, NOW).applicable).toBe(false);
  });

  it("rejects windows that do not increase", () => {
    expect(
      RewardsExpiryParamsSchema.safeParse({
        shortWindowDays: 60,
        midWindowDays: 30,
        longWindowDays: 90,
        roundingMode: "half_up",
      }).success,
    ).toBe(false);
  });
});
