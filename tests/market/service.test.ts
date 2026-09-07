import { describe, expect, it } from "vitest";
import { MockMarketDataService } from "@/services/market/MockMarketDataService";
import { canUse, quoteDelay, features } from "@/lib/market/plan";

const svc = new MockMarketDataService();

describe("plan gating", () => {
  it("delays free quotes by 15 minutes, premium is live", () => {
    expect(quoteDelay("free")).toBe(15);
    expect(quoteDelay("premium")).toBe(0);
  });

  it("gates premium-only capabilities", () => {
    expect(canUse("free", "liveStreaming")).toBe(false);
    expect(canUse("premium", "liveStreaming")).toBe(true);
    expect(canUse("free", "alerts")).toBe(false);
    expect(features("free").maxPortfolios).toBe(1);
    expect(features("premium").maxPortfolios).toBe(10);
  });
});

describe("MockMarketDataService", () => {
  it("returns an overview with movers and sectors", async () => {
    const o = await svc.getMarketOverview("free");
    expect(o.index.name).toContain("QE");
    expect(o.sectors.length).toBeGreaterThan(0);
    expect(o.gainers.length).toBe(5);
    expect(o.losers.length).toBe(5);
    // gainers should be sorted descending by % change
    for (let i = 1; i < o.gainers.length; i++) {
      expect(o.gainers[i - 1].changePercent).toBeGreaterThanOrEqual(o.gainers[i].changePercent);
    }
  });

  it("searches by symbol and name", async () => {
    const bySym = await svc.searchInstruments("qnb");
    expect(bySym.some((i) => i.symbol === "QNBK")).toBe(true);
    const byName = await svc.searchInstruments("ooredoo");
    expect(byName.some((i) => i.symbol === "ORDS")).toBe(true);
    expect(await svc.searchInstruments("")).toHaveLength(0);
  });

  it("returns macro series and null for unknown ids", async () => {
    expect(await svc.getMacroSeries("qcb_policy_rate")).not.toBeNull();
    expect(await svc.getMacroSeries("nope")).toBeNull();
    expect((await svc.listMacroSeries()).length).toBeGreaterThan(3);
  });

  it("returns GCC indices with normalized YTD series", async () => {
    const gcc = await svc.getGCCIndices();
    expect(gcc.length).toBeGreaterThan(3);
    expect(gcc[0].ytd.length).toBeGreaterThan(0);
    expect(gcc[0].country).toBeTruthy();
  });

  it("is flagged as mock data", () => {
    expect(svc.isMock).toBe(true);
  });
});
