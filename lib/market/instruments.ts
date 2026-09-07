/**
 * Static reference universe for the Qatar Market Dashboard.
 *
 * v1 covers: the QE All-Share index + sector indices, ~16 major Qatari listed
 * companies, GCC indices, and global macro tiles. Prices here are *anchor*
 * (reference) levels the mock generator walks around; swapping in a real
 * provider only replaces the price feed, not this catalogue.
 */
import type { Instrument, Sector, SectorId, MarketId } from "@/types/market";

export const SECTORS: Sector[] = [
  { id: "banks", name: "Banks & Financials" },
  { id: "industrials", name: "Industrials" },
  { id: "insurance", name: "Insurance" },
  { id: "telecoms", name: "Telecoms" },
  { id: "realestate", name: "Real Estate" },
  { id: "consumer", name: "Consumer Goods & Services" },
  { id: "transport", name: "Transport" },
];

export const SECTOR_LABEL: Record<SectorId, string> = Object.fromEntries(
  SECTORS.map((s) => [s.id, s.name]),
) as Record<SectorId, string>;

/** The headline QE index. */
export const QE_INDEX: Instrument = {
  symbol: "QSE",
  name: "QE All Share Index",
  assetClass: "index",
  market: "QE",
  currency: "QAR",
  refPrice: 10420,
};

/** QE sector sub-indices (level ~ base 1000-4000). */
export const QE_SECTOR_INDICES: Instrument[] = [
  { symbol: "QSE.BANKS", name: "QE Banks & Financial Services", assetClass: "sector", market: "QE", currency: "QAR", sector: "banks", refPrice: 4180 },
  { symbol: "QSE.IND", name: "QE Industrials", assetClass: "sector", market: "QE", currency: "QAR", sector: "industrials", refPrice: 3120 },
  { symbol: "QSE.INS", name: "QE Insurance", assetClass: "sector", market: "QE", currency: "QAR", sector: "insurance", refPrice: 2380 },
  { symbol: "QSE.TEL", name: "QE Telecoms", assetClass: "sector", market: "QE", currency: "QAR", sector: "telecoms", refPrice: 1610 },
  { symbol: "QSE.RE", name: "QE Real Estate", assetClass: "sector", market: "QE", currency: "QAR", sector: "realestate", refPrice: 1490 },
  { symbol: "QSE.CONS", name: "QE Consumer Goods & Services", assetClass: "sector", market: "QE", currency: "QAR", sector: "consumer", refPrice: 8250 },
  { symbol: "QSE.TRAN", name: "QE Transportation", assetClass: "sector", market: "QE", currency: "QAR", sector: "transport", refPrice: 4460 },
];

/** ~16 major Qatari listed companies (mock reference prices, QAR). */
export const QE_STOCKS: Instrument[] = [
  { symbol: "QNBK", name: "Qatar National Bank", assetClass: "equity", market: "QE", currency: "QAR", sector: "banks", refPrice: 16.2, sharesOutstandingM: 9236 },
  { symbol: "QIBK", name: "Qatar Islamic Bank", assetClass: "equity", market: "QE", currency: "QAR", sector: "banks", refPrice: 22.4, sharesOutstandingM: 2363 },
  { symbol: "CBQK", name: "Commercial Bank of Qatar", assetClass: "equity", market: "QE", currency: "QAR", sector: "banks", refPrice: 4.35, sharesOutstandingM: 4047 },
  { symbol: "MARK", name: "Masraf Al Rayan", assetClass: "equity", market: "QE", currency: "QAR", sector: "banks", refPrice: 2.48, sharesOutstandingM: 9300 },
  { symbol: "QFLS", name: "Qatar Fuel (WOQOD)", assetClass: "equity", market: "QE", currency: "QAR", sector: "consumer", refPrice: 15.1, sharesOutstandingM: 993 },
  { symbol: "IQCD", name: "Industries Qatar", assetClass: "equity", market: "QE", currency: "QAR", sector: "industrials", refPrice: 12.85, sharesOutstandingM: 6050 },
  { symbol: "GISS", name: "Gulf International Services", assetClass: "equity", market: "QE", currency: "QAR", sector: "industrials", refPrice: 2.72, sharesOutstandingM: 1858 },
  { symbol: "QAMC", name: "Qatar Aluminium Manufacturing", assetClass: "equity", market: "QE", currency: "QAR", sector: "industrials", refPrice: 1.34, sharesOutstandingM: 5580 },
  { symbol: "MPHC", name: "Mesaieed Petrochemical Holding", assetClass: "equity", market: "QE", currency: "QAR", sector: "industrials", refPrice: 1.71, sharesOutstandingM: 12563 },
  { symbol: "ORDS", name: "Ooredoo", assetClass: "equity", market: "QE", currency: "QAR", sector: "telecoms", refPrice: 11.35, sharesOutstandingM: 3203 },
  { symbol: "VFQS", name: "Vodafone Qatar", assetClass: "equity", market: "QE", currency: "QAR", sector: "telecoms", refPrice: 1.78, sharesOutstandingM: 4225 },
  { symbol: "QGTS", name: "Qatar Gas Transport (Nakilat)", assetClass: "equity", market: "QE", currency: "QAR", sector: "transport", refPrice: 4.02, sharesOutstandingM: 5540 },
  { symbol: "QNNS", name: "Qatar Navigation (Milaha)", assetClass: "equity", market: "QE", currency: "QAR", sector: "transport", refPrice: 10.9, sharesOutstandingM: 1145 },
  { symbol: "UDCD", name: "United Development Company", assetClass: "equity", market: "QE", currency: "QAR", sector: "realestate", refPrice: 1.16, sharesOutstandingM: 3540 },
  { symbol: "BRES", name: "Barwa Real Estate", assetClass: "equity", market: "QE", currency: "QAR", sector: "realestate", refPrice: 2.66, sharesOutstandingM: 3893 },
  { symbol: "QATI", name: "Qatar Insurance Company", assetClass: "equity", market: "QE", currency: "QAR", sector: "insurance", refPrice: 2.05, sharesOutstandingM: 3268 },
  { symbol: "QGRI", name: "Qatar General Insurance & Reinsurance", assetClass: "equity", market: "QE", currency: "QAR", sector: "insurance", refPrice: 1.02, sharesOutstandingM: 875 },
];

/** GCC indices for the comparison panel. */
export const GCC_INDICES: Instrument[] = [
  { symbol: "TASI", name: "Saudi Tadawul All Share", assetClass: "index", market: "TADAWUL", currency: "SAR", refPrice: 12180 },
  { symbol: "ADX", name: "Abu Dhabi Securities (FADGI)", assetClass: "index", market: "ADX", currency: "AED", refPrice: 9420 },
  { symbol: "DFMGI", name: "Dubai Financial Market General", assetClass: "index", market: "DFM", currency: "AED", refPrice: 4310 },
  { symbol: "KWSE", name: "Kuwait Premier Market", assetClass: "index", market: "KWSE", currency: "KWD", refPrice: 7650 },
  { symbol: "BHSE", name: "Bahrain All Share", assetClass: "index", market: "BHB", currency: "BHD", refPrice: 2010 },
  { symbol: "MSM30", name: "Muscat Securities MSX 30", assetClass: "index", market: "MSM", currency: "OMR", refPrice: 4680 },
];

/** Global macro tiles (oil, rates, FX, DXY). */
export const GLOBAL_MACRO: Instrument[] = [
  { symbol: "BRENT", name: "Brent Crude", assetClass: "commodity", market: "GLOBAL", currency: "USD", refPrice: 82.4 },
  { symbol: "WTI", name: "WTI Crude", assetClass: "commodity", market: "GLOBAL", currency: "USD", refPrice: 78.1 },
  { symbol: "US10Y", name: "US 10Y Treasury Yield", assetClass: "rate", market: "GLOBAL", currency: "%", refPrice: 4.18 },
  { symbol: "DXY", name: "US Dollar Index", assetClass: "fx", market: "GLOBAL", currency: "IDX", refPrice: 103.6 },
  { symbol: "USDQAR", name: "USD / QAR (pegged 3.64)", assetClass: "fx", market: "GLOBAL", currency: "QAR", refPrice: 3.64 },
  { symbol: "EURQAR", name: "EUR / QAR", assetClass: "fx", market: "GLOBAL", currency: "QAR", refPrice: 3.94 },
  { symbol: "GBPQAR", name: "GBP / QAR", assetClass: "fx", market: "GLOBAL", currency: "QAR", refPrice: 4.62 },
];

/** Definitions for macro series (data generated on demand). */
export interface MacroSeriesDef {
  id: string;
  name: string;
  unit: string;
  frequency: "monthly" | "quarterly" | "annual";
  source: string;
  /** Baseline latest value and drift shape for the generator. */
  base: number;
  trend: number;
  volatility: number;
  min?: number;
  max?: number;
}

export const MACRO_SERIES_DEFS: MacroSeriesDef[] = [
  { id: "qcb_policy_rate", name: "QCB Policy (Lending) Rate", unit: "%", frequency: "monthly", source: "Qatar Central Bank", base: 5.75, trend: -0.15, volatility: 0.05, min: 2, max: 7 },
  { id: "qcb_deposit_rate", name: "QCB Deposit Rate", unit: "%", frequency: "monthly", source: "Qatar Central Bank", base: 5.25, trend: -0.15, volatility: 0.05, min: 1.5, max: 6.5 },
  { id: "qatar_cpi_yoy", name: "Qatar Inflation (CPI YoY)", unit: "%", frequency: "monthly", source: "Qatar Planning & Statistics Authority", base: 1.6, trend: 0.05, volatility: 0.25, min: -1, max: 6 },
  { id: "qatar_gdp_growth", name: "Qatar Real GDP Growth", unit: "%", frequency: "quarterly", source: "Qatar Planning & Statistics Authority", base: 2.4, trend: 0.1, volatility: 0.4, min: -3, max: 8 },
  { id: "qatar_m2", name: "Qatar Money Supply (M2)", unit: "QAR bn", frequency: "monthly", source: "Qatar Central Bank", base: 720, trend: 2.5, volatility: 6, min: 500 },
  { id: "qatar_credit_growth", name: "Qatar Private Credit Growth (YoY)", unit: "%", frequency: "monthly", source: "Qatar Central Bank", base: 4.2, trend: 0.08, volatility: 0.5, min: -2, max: 12 },
];

/** Everything tradable/searchable in one flat list. */
export const ALL_INSTRUMENTS: Instrument[] = [
  QE_INDEX,
  ...QE_SECTOR_INDICES,
  ...QE_STOCKS,
  ...GCC_INDICES,
  ...GLOBAL_MACRO,
];

const BY_SYMBOL = new Map(ALL_INSTRUMENTS.map((i) => [i.symbol, i]));

export function getInstrument(symbol: string): Instrument | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

export function isValidSymbol(symbol: string): boolean {
  return BY_SYMBOL.has(symbol.toUpperCase());
}
