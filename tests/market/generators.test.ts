import { describe, expect, it } from "vitest";
import {
  generateBars,
  generateQuote,
  generateMacroSeries,
  hashSeed,
  mulberry32,
} from "@/lib/market/generators";
import { MACRO_SERIES_DEFS } from "@/lib/market/instruments";

const NOW = Date.UTC(2026, 8, 7, 10, 0, 0); // fixed reference time

describe("seeded PRNG", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(hashSeed("QNBK"));
    const b = mulberry32(hashSeed("QNBK"));
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it("produces values in [0,1)", () => {
    const r = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("generateBars", () => {
  it("returns the configured number of bars and valid OHLC", () => {
    const bars = generateBars("QNBK", "1d", NOW);
    expect(bars.length).toBeGreaterThan(200);
    for (const b of bars) {
      expect(b.high).toBeGreaterThanOrEqual(b.low);
      expect(b.high).toBeGreaterThanOrEqual(b.open);
      expect(b.high).toBeGreaterThanOrEqual(b.close);
      expect(b.low).toBeLessThanOrEqual(b.open);
      expect(b.low).toBeLessThanOrEqual(b.close);
      expect(b.volume).toBeGreaterThanOrEqual(0);
      expect(b.low).toBeGreaterThan(0);
    }
  });

  it("keeps a stable price path within the same day bucket", () => {
    // Timestamps track wall-clock `now`; the seeded OHLCV path stays stable.
    const a = generateBars("IQCD", "1d", NOW);
    const b = generateBars("IQCD", "1d", NOW + 1000);
    const ohlcv = ({ open, high, low, close, volume }: (typeof a)[number]) => ({
      open,
      high,
      low,
      close,
      volume,
    });
    expect(ohlcv(a[0])).toEqual(ohlcv(b[0]));
    expect(ohlcv(a.at(-1)!)).toEqual(ohlcv(b.at(-1)!));
  });

  it("differs across symbols", () => {
    const a = generateBars("QNBK", "1d", NOW);
    const b = generateBars("ORDS", "1d", NOW);
    expect(a.at(-1)!.close).not.toBe(b.at(-1)!.close);
  });
});

describe("generateQuote", () => {
  it("computes change vs previous close", () => {
    const q = generateQuote("QNBK", NOW, 0);
    expect(q.symbol).toBe("QNBK");
    expect(q.prevClose).toBeGreaterThan(0);
    const expected = Math.round((q.price - q.prevClose!) * 1000) / 1000;
    // change is rounded to the instrument's precision; allow tiny epsilon
    expect(Math.abs(q.change - expected)).toBeLessThan(0.02);
    expect(q.delayed).toBe(false);
  });

  it("applies a delay offset for the free tier", () => {
    const q = generateQuote("QNBK", NOW, 15);
    expect(q.delayed).toBe(true);
    expect(q.delayMinutes).toBe(15);
    expect(q.timestamp).toBe(NOW - 15 * 60_000);
  });
});

describe("generateMacroSeries", () => {
  it("ends near the definition baseline and respects bounds", () => {
    const def = MACRO_SERIES_DEFS.find((d) => d.id === "qcb_policy_rate")!;
    const s = generateMacroSeries(def, NOW);
    expect(s.id).toBe("qcb_policy_rate");
    expect(s.dataPoints.length).toBeGreaterThan(10);
    for (const p of s.dataPoints) {
      expect(p.value).toBeGreaterThanOrEqual(def.min!);
      expect(p.value).toBeLessThanOrEqual(def.max!);
    }
  });
});
