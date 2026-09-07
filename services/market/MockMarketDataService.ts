/**
 * MockMarketDataService — the default provider.
 *
 * Produces realistic-looking QE index/sector/stock data, intraday + daily
 * candles, fundamentals, macro series, and GCC/global context — all from the
 * deterministic generators. Every payload is normalized to the internal data
 * models, so the real provider is a drop-in replacement.
 */
import type { MarketDataService } from "./MarketDataService";
import type {
  Bar,
  Fundamentals,
  GccIndex,
  GlobalMacroTile,
  Instrument,
  MacroSeries,
  MarketMover,
  MarketOverview,
  PlanTier,
  Quote,
  Timeframe,
} from "@/types/market";
import {
  ALL_INSTRUMENTS,
  GCC_INDICES,
  GLOBAL_MACRO,
  MACRO_SERIES_DEFS,
  QE_INDEX,
  QE_STOCKS,
  SECTORS,
  getInstrument,
} from "@/lib/market/instruments";
import {
  generateBars,
  generateFundamentals,
  generateMacroSeries,
  generateNormalizedPerf,
  generateQuote,
} from "@/lib/market/generators";
import { quoteDelay } from "@/lib/market/plan";
import { cached } from "./cache";

export class MockMarketDataService implements MarketDataService {
  readonly sourceLabel = "Demo data (simulated) — connect an API for live";
  readonly isMock = true;

  async getQuote(symbol: string, plan: PlanTier = "free"): Promise<Quote> {
    return generateQuote(symbol.toUpperCase(), Date.now(), quoteDelay(plan));
  }

  async getQuotes(
    symbols: string[],
    plan: PlanTier = "free",
  ): Promise<Record<string, Quote>> {
    const delay = quoteDelay(plan);
    const now = Date.now();
    const out: Record<string, Quote> = {};
    for (const s of symbols) {
      out[s.toUpperCase()] = generateQuote(s.toUpperCase(), now, delay);
    }
    return out;
  }

  async getHistoricalBars(
    symbol: string,
    timeframe: Timeframe,
  ): Promise<Bar[]> {
    // Historical bars cache for 30s (intraday) / 5m (daily).
    const ttl = timeframe === "1d" ? 300 : 30;
    return cached(`bars:${symbol}:${timeframe}`, ttl, () =>
      generateBars(symbol.toUpperCase(), timeframe),
    );
  }

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    return generateFundamentals(symbol.toUpperCase());
  }

  async getMacroSeries(seriesId: string): Promise<MacroSeries | null> {
    const def = MACRO_SERIES_DEFS.find((d) => d.id === seriesId);
    if (!def) return null;
    return cached(`macro:${seriesId}`, 3600, () => generateMacroSeries(def));
  }

  async listMacroSeries(): Promise<MacroSeries[]> {
    return Promise.all(
      MACRO_SERIES_DEFS.map((d) =>
        cached(`macro:${d.id}`, 3600, () => generateMacroSeries(d)),
      ),
    );
  }

  async getGCCIndices(): Promise<GccIndex[]> {
    const now = Date.now();
    return GCC_INDICES.map((inst) => ({
      symbol: inst.symbol,
      name: inst.name,
      country: countryFor(inst.symbol),
      quote: generateQuote(inst.symbol, now, 0),
      ytd: generateNormalizedPerf(inst, ytdDays(now), now),
    }));
  }

  async getGlobalMacro(plan: PlanTier = "free"): Promise<GlobalMacroTile[]> {
    const now = Date.now();
    const delay = quoteDelay(plan);
    return GLOBAL_MACRO.map((inst) => ({
      symbol: inst.symbol,
      name: inst.name,
      quote: generateQuote(inst.symbol, now, delay),
      unit: inst.currency,
    }));
  }

  async getMarketOverview(plan: PlanTier = "free"): Promise<MarketOverview> {
    const now = Date.now();
    const delay = quoteDelay(plan);
    const indexQuote = generateQuote(QE_INDEX.symbol, now, delay);

    const sectors = SECTORS.map((sector) => {
      const idx = ALL_INSTRUMENTS.find(
        (i) => i.assetClass === "sector" && i.sector === sector.id,
      );
      const q = idx ? generateQuote(idx.symbol, now, delay) : null;
      return {
        sector,
        changePercent: q?.changePercent ?? 0,
        value: q?.price ?? 0,
      };
    });

    const movers: MarketMover[] = QE_STOCKS.map((inst) => {
      const q = generateQuote(inst.symbol, now, delay);
      return { ...q, name: inst.name, sector: inst.sector };
    });

    const byChange = [...movers].sort(
      (a, b) => b.changePercent - a.changePercent,
    );
    const byVolume = [...movers].sort((a, b) => b.volume - a.volume);

    return {
      index: { ...indexQuote, name: QE_INDEX.name },
      sectors,
      gainers: byChange.slice(0, 5),
      losers: byChange.slice(-5).reverse(),
      mostActive: byVolume.slice(0, 5),
      asOf: indexQuote.timestamp,
    };
  }

  async searchInstruments(query: string, limit = 12): Promise<Instrument[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = ALL_INSTRUMENTS.map((inst) => {
      const sym = inst.symbol.toLowerCase();
      const name = inst.name.toLowerCase();
      let score = -1;
      if (sym === q) score = 100;
      else if (sym.startsWith(q)) score = 80;
      else if (name.startsWith(q)) score = 60;
      else if (sym.includes(q)) score = 40;
      else if (name.includes(q)) score = 20;
      return { inst, score };
    })
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.inst);
  }
}

function countryFor(symbol: string): string {
  switch (symbol) {
    case "TASI":
      return "Saudi Arabia";
    case "ADX":
      return "UAE (Abu Dhabi)";
    case "DFMGI":
      return "UAE (Dubai)";
    case "KWSE":
      return "Kuwait";
    case "BHSE":
      return "Bahrain";
    case "MSM30":
      return "Oman";
    default:
      return "GCC";
  }
}

/** Days since Jan 1 of the current year. */
function ytdDays(now: number): number {
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.max(1, Math.floor((now - start) / 86_400_000));
}

// Re-export for callers that only need the instrument helper.
export { getInstrument };
