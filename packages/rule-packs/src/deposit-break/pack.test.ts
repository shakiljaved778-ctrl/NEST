import { describe, expect, it } from "vitest";
import { aishaDeposit, financeThresholds, NOW } from "../fixtures";
import { PACKS } from "../registry";
import { evaluateDepositBreak } from "./pack";

const params = PACKS["deposit.break"].conventional.defaultParameters;

describe("deposit.break", () => {
  it("worked example: Aisha, 200,000 at 4.25%, 9 days from maturity", () => {
    // term 365 days, 356 elapsed. At maturity 8,500.00. Broken today at 0.25%: 487.67.
    // Penalty max(0.5% × 200,000, 250) = 1,000.00 -> 199,487.67. Accrued at 4.25%: 8,290.41.
    const ev = evaluateDepositBreak(aishaDeposit(), params, financeThresholds, NOW);
    const v = Object.fromEntries(
      Object.entries(ev.facts)
        .filter(([k]) => k !== "_sources")
        .map(([k, f]) => [k, (f as { value: string }).value]),
    );
    expect(v).toEqual({
      principal: "200000.00",
      ratePct: "4.25",
      maturityDate: "2026-10-09",
      daysToMaturity: "9",
      profitAtMaturity: "8500.00",
      profitIfBrokenToday: "487.67",
      profitForfeited: "7802.74",
      breakPenalty: "1000.00",
      netReceivedNow: "199487.67",
      netAtMaturity: "208500.00",
      differenceIfKeptToMaturity: "9012.33",
    });
    expect([ev.applicable, ev.severity]).toEqual([true, "critical"]);
    expect(ev.explanation.slice(0, 2)).toEqual([
      "break_penalty_applies",
      "breaking_reduces_profit",
    ]);
    expect(ev.options).toEqual(["keep_until_maturity", "continue_break", "talk_to_someone"]);
  });

  it.each([
    // fixed 500.00 penalty, no profit on break
    [
      {
        breakPenaltyRule: { type: "fixed", amount: "500.00" },
        profitOnBreakRule: { type: "none" },
      },
      "500.00",
      "0.00",
      "199500.00",
    ],
    // 0.1% of 200,000 = 200 -> capped at 150.00
    [
      { breakPenaltyRule: { type: "pct_of_principal", pct: "0.10", max: "150.00" } },
      "150.00",
      "487.67",
      "200337.67",
    ],
    // no penalty
    [{ breakPenaltyRule: { type: "none" } }, "0.00", "487.67", "200487.67"],
  ] as const)("penalty and profit rules %#", (overrides, penalty, profit, net) => {
    const ev = evaluateDepositBreak(aishaDeposit(overrides), params, financeThresholds, NOW);
    expect([
      ev.facts.breakPenalty.value,
      ev.facts.profitIfBrokenToday.value,
      ev.facts.netReceivedNow.value,
    ]).toEqual([penalty, profit, net]);
  });

  it("is not applicable on or after maturity", () => {
    const ev = evaluateDepositBreak(
      aishaDeposit(),
      params,
      financeThresholds,
      new Date("2026-10-12T08:00:00Z"),
    );
    expect(ev.facts.daysToMaturity.value).toBe("0");
    expect(ev.applicable).toBe(false);
  });

  it("treats a deposit that has not started as nothing elapsed", () => {
    const ev = evaluateDepositBreak(
      aishaDeposit(),
      params,
      financeThresholds,
      new Date("2025-10-01T08:00:00Z"),
    );
    expect([ev.facts.daysToMaturity.value, ev.facts.profitIfBrokenToday.value]).toEqual([
      "365",
      "0.00",
    ]);
  });
});
