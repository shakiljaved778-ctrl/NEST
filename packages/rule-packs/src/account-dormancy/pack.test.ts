import { describe, expect, it } from "vitest";
import { dormancy, NOW } from "../fixtures";
import { PACKS } from "../registry";
import { AccountDormancyParamsSchema, evaluateAccountDormancy } from "./pack";

const params = PACKS["account.dormancy"].conventional.defaultParameters;

describe("account.dormancy", () => {
  it.each([
    // Grace: 340 days -> dormant on 2026-10-25 in 25 days (<= 30: critical)
    [340, true, "critical", "25", "2026-10-25"],
    // Tariq: 320 days -> 45 days (<= 60: caution)
    [320, true, "caution", "45", "2026-11-14"],
    // boundaries: 60 days left is shown, 61 is not; 30 is critical
    [305, true, "caution", "60", "2026-11-29"],
    [304, false, "caution", "61", "2026-11-30"],
    [335, true, "critical", "30", "2026-10-30"],
    // already dormant by date (0 days left): not shown
    [365, false, "critical", "0", "2026-09-30"],
  ] as const)(
    "%d days inactive: applicable %s, %s, %s days, %s",
    (ago, applicable, severity, days, date) => {
      const ev = evaluateAccountDormancy(dormancy(ago), params, NOW);
      expect([
        ev.applicable,
        ev.severity,
        ev.facts.daysUntilDormancy.value,
        ev.facts.dormancyDate.value,
      ]).toEqual([applicable, severity, days, date]);
    },
  );

  it("emits the facts and options of a proactive pack (no continue option)", () => {
    const ev = evaluateAccountDormancy(dormancy(340), params, NOW);
    expect([
      ev.facts.lastActivityDate.value,
      ev.facts.daysSinceLastActivity.value,
      ev.facts.currentBalance.value,
    ]).toEqual(["2025-10-25", "340", "3150.00"]);
    expect(ev.options).toEqual(["make_a_transaction", "talk_to_someone"]);
  });

  it("ignores accounts that are not active", () => {
    expect(
      evaluateAccountDormancy(dormancy(340, { status: "dormant" }), params, NOW).applicable,
    ).toBe(false);
  });

  it("rejects a critical window wider than the warning window", () => {
    expect(
      AccountDormancyParamsSchema.safeParse({ warnWithinDays: 30, criticalWithinDays: 60 }).success,
    ).toBe(false);
  });
});
