/**
 * RealApiMarketDataService — provider stub.
 *
 * This is where a real feed is wired in. It implements the SAME
 * {@link MarketDataService} interface as the mock, so flipping
 * MARKET_DATA_PROVIDER=real (see ./index.ts) swaps the whole app over with no
 * other code change.
 *
 * Suggested providers:
 *   - Global equities/fundamentals: Financial Modeling Prep, Polygon, Alpha Vantage
 *   - Qatar (QE): local QSE data partner / vendor feed
 *   - Qatar macro/FX (QCB): data.gov.qa, QCB reports, AllRatesToday QCB FX API
 *
 * Every method below normalizes the vendor payload into the internal data
 * models (Quote/Bar/MacroSeries/...). Until a key is configured it throws so
 * the factory can safely fall back to the mock.
 */
import type { MarketDataService } from "./MarketDataService";
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

interface RealApiConfig {
  equitiesApiKey?: string;
  equitiesBaseUrl?: string;
  qseApiKey?: string;
  qcbApiKey?: string;
}

export class RealApiMarketDataService implements MarketDataService {
  readonly sourceLabel = "Live provider";
  readonly isMock = false;

  constructor(private config: RealApiConfig) {}

  private assertConfigured() {
    if (!this.config.equitiesApiKey) {
      throw new Error(
        "RealApiMarketDataService: MARKET_DATA_API_KEY not set. Configure keys or use MARKET_DATA_PROVIDER=mock.",
      );
    }
  }

  async getQuote(_symbol: string, _plan?: PlanTier): Promise<Quote> {
    this.assertConfigured();
    // TODO: fetch `${baseUrl}/quote/${symbol}?apikey=...`, then normalize:
    //   return { symbol, price, change, changePercent, volume, timestamp };
    throw new Error("getQuote: not implemented — provide a real API integration.");
  }

  async getQuotes(
    _symbols: string[],
    _plan?: PlanTier,
  ): Promise<Record<string, Quote>> {
    this.assertConfigured();
    // TODO: batch-quote endpoint, normalize into a symbol→Quote map.
    throw new Error("getQuotes: not implemented.");
  }

  async getHistoricalBars(
    _symbol: string,
    _timeframe: Timeframe,
    _plan?: PlanTier,
  ): Promise<Bar[]> {
    this.assertConfigured();
    // TODO: map timeframe → provider interval, fetch aggregates, normalize OHLCV.
    throw new Error("getHistoricalBars: not implemented.");
  }

  async getFundamentals(_symbol: string): Promise<Fundamentals> {
    this.assertConfigured();
    // TODO: fetch company profile + ratios (FMP /profile + /ratios-ttm).
    throw new Error("getFundamentals: not implemented.");
  }

  async getMacroSeries(_seriesId: string): Promise<MacroSeries | null> {
    // TODO: QCB / data.gov.qa series → MacroSeries. May not need equities key.
    throw new Error("getMacroSeries: not implemented.");
  }

  async listMacroSeries(): Promise<MacroSeries[]> {
    throw new Error("listMacroSeries: not implemented.");
  }

  async getGCCIndices(): Promise<GccIndex[]> {
    this.assertConfigured();
    throw new Error("getGCCIndices: not implemented.");
  }

  async getGlobalMacro(_plan?: PlanTier): Promise<GlobalMacroTile[]> {
    this.assertConfigured();
    throw new Error("getGlobalMacro: not implemented.");
  }

  async getMarketOverview(_plan?: PlanTier): Promise<MarketOverview> {
    this.assertConfigured();
    throw new Error("getMarketOverview: not implemented.");
  }

  async searchInstruments(_query: string, _limit?: number): Promise<Instrument[]> {
    // Symbol search can stay local (static universe) even with a live price feed.
    throw new Error("searchInstruments: not implemented.");
  }
}
