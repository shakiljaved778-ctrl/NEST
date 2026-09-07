import { describe, expect, it } from "vitest";
import { suggestRebalance } from "@/lib/market/rebalance";
import type { PortfolioValuation } from "@/types/market";

function valuation(partial: Partial<PortfolioValuation>): PortfolioValuation {
  return {
    portfolioId: "pf",
    totalValue: 10000,
    totalCost: 9000,
    cash: 0,
    pnl: 1000,
    pnlPercent: 11,
    dayChange: 0,
    dayChangePercent: 0,
    rows: [],
    allocationBySector: [],
    ...partial,
  };
}

describe("suggestRebalance", () => {
  it("returns a reassurance when nothing is flagged", () => {
    const v = valuation({
      rows: [
        { holding: { id: "1", symbol: "A", quantity: 1, avgPrice: 1 }, name: "A", price: 1, marketValue: 2000, costBasis: 2000, pnl: 0, pnlPercent: 0, weight: 20 },
        { holding: { id: "2", symbol: "B", quantity: 1, avgPrice: 1 }, name: "B", price: 1, marketValue: 2000, costBasis: 2000, pnl: 0, pnlPercent: 0, weight: 20 },
        { holding: { id: "3", symbol: "C", quantity: 1, avgPrice: 1 }, name: "C", price: 1, marketValue: 2000, costBasis: 2000, pnl: 0, pnlPercent: 0, weight: 20 },
        { holding: { id: "4", symbol: "D", quantity: 1, avgPrice: 1 }, name: "D", price: 1, marketValue: 2000, costBasis: 2000, pnl: 0, pnlPercent: 0, weight: 20 },
      ],
    });
    const s = suggestRebalance(v, "medium");
    expect(s).toHaveLength(1);
    expect(s[0].id).toBe("ok");
  });

  it("flags an over-weight single position", () => {
    const v = valuation({
      rows: [
        { holding: { id: "1", symbol: "QNBK", quantity: 1, avgPrice: 1 }, name: "QNBK", sector: "banks", price: 1, marketValue: 6000, costBasis: 6000, pnl: 0, pnlPercent: 0, weight: 60 },
        { holding: { id: "2", symbol: "B", quantity: 1, avgPrice: 1 }, name: "B", price: 1, marketValue: 4000, costBasis: 4000, pnl: 0, pnlPercent: 0, weight: 40 },
      ],
    });
    const s = suggestRebalance(v, "medium");
    expect(s.some((x) => x.id === "pos-QNBK")).toBe(true);
  });

  it("flags sector concentration", () => {
    const v = valuation({
      rows: [
        { holding: { id: "1", symbol: "A", quantity: 1, avgPrice: 1 }, name: "A", sector: "banks", price: 1, marketValue: 3000, costBasis: 3000, pnl: 0, pnlPercent: 0, weight: 30 },
        { holding: { id: "2", symbol: "B", quantity: 1, avgPrice: 1 }, name: "B", sector: "banks", price: 1, marketValue: 3000, costBasis: 3000, pnl: 0, pnlPercent: 0, weight: 30 },
        { holding: { id: "3", symbol: "C", quantity: 1, avgPrice: 1 }, name: "C", sector: "banks", price: 1, marketValue: 4000, costBasis: 4000, pnl: 0, pnlPercent: 0, weight: 40 },
      ],
      allocationBySector: [{ sector: "banks", label: "Banks & Financials", value: 10000, weight: 100 }],
    });
    const s = suggestRebalance(v, "medium");
    expect(s.some((x) => x.id === "sec-banks")).toBe(true);
  });

  it("returns nothing for an empty portfolio", () => {
    expect(suggestRebalance(valuation({ rows: [], totalValue: 0 }), "medium")).toHaveLength(0);
  });
});
