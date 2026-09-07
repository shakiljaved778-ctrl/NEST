import { describe, expect, it } from "vitest";
import { valuePortfolio } from "@/lib/market/portfolioMath";
import type { Portfolio, Quote } from "@/types/market";

function quote(symbol: string, price: number, prevClose: number): Quote {
  return {
    symbol,
    price,
    change: price - prevClose,
    changePercent: ((price - prevClose) / prevClose) * 100,
    volume: 1000,
    timestamp: 0,
    prevClose,
  };
}

const portfolio: Portfolio = {
  id: "pf1",
  name: "Test",
  cash: 1000,
  createdAt: 0,
  holdings: [
    { id: "h1", symbol: "QNBK", quantity: 100, avgPrice: 15 }, // banks
    { id: "h2", symbol: "IQCD", quantity: 200, avgPrice: 12 }, // industrials
  ],
};

const quotes: Record<string, Quote> = {
  QNBK: quote("QNBK", 16, 15.5),
  IQCD: quote("IQCD", 13, 13.2),
};

describe("valuePortfolio", () => {
  const v = valuePortfolio(portfolio, quotes);

  it("computes market value and cost basis", () => {
    // 100*16 + 200*13 = 1600 + 2600 = 4200
    expect(v.totalValue).toBe(4200);
    // 100*15 + 200*12 = 1500 + 2400 = 3900
    expect(v.totalCost).toBe(3900);
    expect(v.pnl).toBe(300);
    expect(v.pnlPercent).toBeCloseTo((300 / 3900) * 100, 5);
  });

  it("computes day change from prevClose", () => {
    // QNBK: (16-15.5)*100 = 50 ; IQCD: (13-13.2)*200 = -40 ; net = 10
    expect(v.dayChange).toBeCloseTo(10, 5);
  });

  it("includes cash in weights but not in cost/value totals", () => {
    expect(v.cash).toBe(1000);
    const totalWeight = v.rows.reduce((s, r) => s + r.weight, 0);
    // holdings weight of investable base (4200 + 1000 = 5200)
    expect(totalWeight).toBeCloseTo((4200 / 5200) * 100, 4);
  });

  it("aggregates allocation by sector", () => {
    const sectors = v.allocationBySector.map((a) => a.sector);
    expect(sectors).toContain("banks");
    expect(sectors).toContain("industrials");
    const sum = v.allocationBySector.reduce((s, a) => s + a.value, 0);
    expect(sum).toBe(4200);
  });

  it("falls back to avg price when a quote is missing", () => {
    const v2 = valuePortfolio(portfolio, {});
    expect(v2.totalValue).toBe(v2.totalCost); // no price movement
    expect(v2.pnl).toBe(0);
  });
});
