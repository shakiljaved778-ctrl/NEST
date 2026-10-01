import { describe, expect, it } from "vitest";
import { toCardCloseInput, toFinanceSettlementInput } from "./adapters";

const NOW = new Date("2026-09-30T09:00:00Z");
const card = {
  id: "c1",
  type: "conventional" as const,
  balance: { toString: () => "100.5" }, // Prisma.Decimal-like
  annualFee: "0.00",
  feeRefundRule: { type: "none" },
};

describe("adapters reject malformed product data instead of guessing", () => {
  it("accepts Decimal-like objects and decimal strings", () => {
    expect(toCardCloseInput(card, null, [], NOW).card.balance).toBe("100.5");
  });

  it.each([
    [
      "a JSON-number fee refund window",
      { ...card, feeRefundRule: { type: "pro_rata_months", withinMonths: 12 } },
    ],
    ["an unknown rule type", { ...card, feeRefundRule: { type: "generous" } }],
    ["a float balance", { ...card, balance: 100.5 }],
  ])("rejects %s", (_name, bad) => {
    expect(() => toCardCloseInput(bad, null, [], NOW)).toThrow();
  });

  it("rejects malformed expiry buckets and EPP rules", () => {
    expect(() =>
      toCardCloseInput(
        card,
        {
          balance: 1,
          pointValueQar: "0.01",
          expiryBuckets: [{ points: 1, expiresAt: "14/11/2026" }],
          asOf: NOW,
        },
        [],
        NOW,
      ),
    ).toThrow();
    expect(() =>
      toCardCloseInput(
        card,
        null,
        [
          {
            id: "p",
            principalRemaining: "1",
            monthsRemaining: 1,
            monthlyAmount: "1",
            earlyClosureFeeRule: { type: "pct_of_remaining", pct: 2 },
          },
        ],
        NOW,
      ),
    ).toThrow();
  });

  it("ignores instalment plans that are not active", () => {
    const plan = {
      id: "p",
      principalRemaining: "1.00",
      monthsRemaining: 1,
      monthlyAmount: "1.00",
      earlyClosureFeeRule: { type: "none" },
      status: "closed",
    };
    expect(toCardCloseInput(card, null, [plan], NOW).instalmentPlans).toEqual([]);
  });

  it("rejects a finance with an empty schedule or a malformed ibra policy", () => {
    const fin = {
      id: "f",
      type: "murabaha" as const,
      ratePct: "4.75",
      tenorMonths: 1,
      startAt: NOW,
      settlementFeeRule: { type: "none" },
    };
    expect(() => toFinanceSettlementInput({ ...fin, schedule: [] }, NOW)).toThrow();
    const schedule = [
      {
        n: 1,
        dueAt: "2026-10-19",
        principal: "1.00",
        profitOrInterest: "0.10",
        instalment: "1.10",
        balanceAfter: "0.00",
        paid: false,
      },
    ];
    expect(() =>
      toFinanceSettlementInput(
        {
          ...fin,
          schedule,
          rebateRule: { type: "ibra_tiers", basis: "deferred_profit_not_yet_due", tiers: [] },
        },
        NOW,
      ),
    ).toThrow();
    expect(toFinanceSettlementInput({ ...fin, schedule }, NOW).finance.rebateRule).toBeNull();
  });
});
