/**
 * MarketDataService — the single abstraction the whole app talks to.
 *
 * The UI and API routes depend ONLY on this interface, never on a concrete
 * provider. Swapping the mock for Financial Modeling Prep / Polygon / Alpha
 * Vantage / a local QSE/QCB feed means implementing this interface once.
 */
import type {
  Bar,
  Fundamentals,
  GccIndex,
  GlobalMacroTile,
  Instrument,
  MacroSeries,
  MarketOverview,
  PlanTier,
  Quote,
  Timeframe,
} from "@/types/market";

export interface MarketDataService {
  /** Human label shown in the "data source" UI (e.g. "Demo (mock)"). */
  readonly sourceLabel: string;
  /** True when returning simulated data (drives the "Demo data" badges). */
  readonly isMock: boolean;

  getQuote(symbol: string, plan?: PlanTier): Promise<Quote>;
  getQuotes(symbols: string[], plan?: PlanTier): Promise<Record<string, Quote>>;

  getHistoricalBars(
    symbol: string,
    timeframe: Timeframe,
    plan?: PlanTier,
  ): Promise<Bar[]>;

  getFundamentals(symbol: string): Promise<Fundamentals>;

  getMacroSeries(seriesId: string): Promise<MacroSeries | null>;
  listMacroSeries(): Promise<MacroSeries[]>;

  getGCCIndices(): Promise<GccIndex[]>;
  getGlobalMacro(plan?: PlanTier): Promise<GlobalMacroTile[]>;

  getMarketOverview(plan?: PlanTier): Promise<MarketOverview>;

  searchInstruments(query: string, limit?: number): Promise<Instrument[]>;
}
