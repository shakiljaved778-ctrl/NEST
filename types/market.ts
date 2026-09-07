/**
 * Qatar Market Dashboard — core domain types.
 *
 * These are the *internal* data models. Every data adapter (mock or real
 * provider) normalizes external payloads into these shapes so the rest of the
 * app never depends on a specific vendor's schema.
 */

/** Candle/aggregation timeframe. */
export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d";

/** Freemium tiers. */
export type PlanTier = "free" | "premium";

/** Asset classes we model in v1. */
export type AssetClass =
  | "equity"
  | "index"
  | "sector"
  | "commodity"
  | "fx"
  | "rate"
  | "macro";

/** Market a listing belongs to. */
export type MarketId = "QE" | "TADAWUL" | "ADX" | "DFM" | "KWSE" | "BHB" | "MSM" | "GLOBAL";

/**
 * A tradable / trackable instrument in the universe (stock, index, FX, etc.).
 * Static reference data — prices live in {@link Quote}/{@link Bar}.
 */
export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  market: MarketId;
  currency: string;
  sector?: SectorId;
  /** Reference/anchor price the mock generator walks around. */
  refPrice: number;
  /** Shares outstanding (millions) — for market-cap style stats. */
  sharesOutstandingM?: number;
}

/** QE sector taxonomy (mirrors QSE sector indices). */
export type SectorId =
  | "banks"
  | "industrials"
  | "insurance"
  | "telecoms"
  | "realestate"
  | "consumer"
  | "transport";

export interface Sector {
  id: SectorId;
  name: string;
}

/** Normalized real-time (or delayed) quote. */
export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  /** Epoch millis of the quote. */
  timestamp: number;
  /** True when the quote is intentionally delayed (free tier / EOD source). */
  delayed?: boolean;
  /** Minutes of delay applied (0 for live). */
  delayMinutes?: number;
  dayOpen?: number;
  dayHigh?: number;
  dayLow?: number;
  prevClose?: number;
}

/** Normalized OHLCV bar. */
export interface Bar {
  /** Epoch millis of the bar's open. */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** A single point in a macro time series. */
export interface MacroPoint {
  timestamp: number;
  value: number;
}

export type MacroFrequency = "daily" | "monthly" | "quarterly" | "annual";

/** Normalized macro-economic series (rates, inflation, GDP, FX...). */
export interface MacroSeries {
  id: string;
  name: string;
  unit: string;
  frequency: MacroFrequency;
  source: string;
  dataPoints: MacroPoint[];
}

/** Fundamentals used on the symbol-detail panel. */
export interface Fundamentals {
  symbol: string;
  peRatio: number;
  dividendYield: number;
  marketCap: number;
  eps: number;
  bookValue: number;
  week52High: number;
  week52Low: number;
  beta: number;
}

/** Row for the gainers/losers / market-overview tables. */
export interface MarketMover extends Quote {
  name: string;
  sector?: SectorId;
}

/** GCC index snapshot for the comparison panel. */
export interface GccIndex {
  symbol: string;
  name: string;
  country: string;
  quote: Quote;
  /** Normalized YTD performance series (base 100). */
  ytd: MacroPoint[];
}

/** A global macro tile (oil, DXY, US10Y, FX crosses). */
export interface GlobalMacroTile {
  symbol: string;
  name: string;
  quote: Quote;
  unit?: string;
}

/** Aggregated dashboard-home payload. */
export interface MarketOverview {
  index: Quote & { name: string };
  sectors: { sector: Sector; changePercent: number; value: number }[];
  gainers: MarketMover[];
  losers: MarketMover[];
  mostActive: MarketMover[];
  asOf: number;
}

/* ------------------------------------------------------------------ */
/* User / account domain (persisted in Postgres in production).        */
/* ------------------------------------------------------------------ */

export type InvestmentHorizon = "days" | "weeks" | "months" | "years";
export type InvestorGoal = "trading" | "long_term" | "income" | "balanced";
export type RiskTolerance = "low" | "medium" | "high";

export interface UserProfile {
  horizon: InvestmentHorizon;
  goal: InvestorGoal;
  risk: RiskTolerance;
  completedOnboarding: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  plan: PlanTier;
  profile: UserProfile | null;
}

export interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export interface Portfolio {
  id: string;
  name: string;
  holdings: Holding[];
  cash: number;
  createdAt: number;
}

/** Computed valuation for a holding (mock live prices). */
export interface HoldingValuation {
  holding: Holding;
  name: string;
  sector?: SectorId;
  price: number;
  marketValue: number;
  costBasis: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
}

export interface PortfolioValuation {
  portfolioId: string;
  totalValue: number;
  totalCost: number;
  cash: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
  rows: HoldingValuation[];
  allocationBySector: { sector: SectorId; label: string; value: number; weight: number }[];
}

export interface RebalanceSuggestion {
  id: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
}

/** Price / % alert (premium). Schema mirrors the DB model. */
export interface PriceAlert {
  id: string;
  symbol: string;
  type: "price_above" | "price_below" | "pct_change";
  threshold: number;
  active: boolean;
  triggeredAt: number | null;
  createdAt: number;
}
