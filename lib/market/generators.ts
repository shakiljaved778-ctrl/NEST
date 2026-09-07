/**
 * Deterministic mock-data generators for the Qatar Market Dashboard.
 *
 * Everything is seeded (symbol + day bucket) so the same request returns stable
 * data within a time window — this keeps server render and client hydration in
 * agreement and makes the demo reproducible. A small intraday jitter seeded by
 * the current minute gives "live-ish" movement without true randomness.
 *
 * When a real provider is wired in ({@link RealApiMarketDataService}), these
 * functions are simply not called — the internal data models are identical.
 */
import type {
  Bar,
  Fundamentals,
  Instrument,
  MacroPoint,
  MacroSeries,
  Quote,
  Timeframe,
} from "@/types/market";
import { getInstrument, type MacroSeriesDef } from "@/lib/market/instruments";

/* --------------------------- seeded PRNG --------------------------- */

/** 32-bit string hash (FNV-1a-ish). */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal via Box–Muller from a uniform generator. */
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const MS = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };
export const DAY_MS = MS.day;

/** Day bucket used to keep a symbol's daily path stable across a session. */
function dayBucket(now: number): number {
  return Math.floor(now / MS.day);
}

/* --------------------------- bars / OHLCV -------------------------- */

interface TfConfig {
  stepMs: number;
  count: number;
  /** Per-step volatility as a fraction of price. */
  vol: number;
}

const TF_CONFIG: Record<Timeframe, TfConfig> = {
  "1m": { stepMs: MS.minute, count: 240, vol: 0.0012 },
  "5m": { stepMs: 5 * MS.minute, count: 240, vol: 0.0025 },
  "15m": { stepMs: 15 * MS.minute, count: 240, vol: 0.004 },
  "1h": { stepMs: MS.hour, count: 240, vol: 0.008 },
  "1d": { stepMs: MS.day, count: 260, vol: 0.014 },
};

/**
 * Generate a deterministic OHLCV series for a symbol/timeframe ending "now".
 * Uses a geometric random walk with mild mean-reversion toward the ref price.
 */
export function generateBars(
  symbol: string,
  timeframe: Timeframe,
  now: number = Date.now(),
): Bar[] {
  const inst = getInstrument(symbol);
  const ref = inst?.refPrice ?? 100;
  const cfg = TF_CONFIG[timeframe];
  const seed = hashSeed(`${symbol}:${timeframe}:${dayBucket(now)}`);
  const rng = mulberry32(seed);

  const bars: Bar[] = [];
  // Start a little below ref so the series tends to drift into "today".
  let price = ref * (0.94 + rng() * 0.12);
  const start = now - cfg.count * cfg.stepMs;
  const avgDailyVol = (inst?.sharesOutstandingM ?? 1000) * 1000 * 0.0009;

  for (let i = 0; i < cfg.count; i++) {
    const t = start + i * cfg.stepMs;
    const open = price;
    const drift = (ref - price) * 0.01; // gentle mean reversion
    const shock = gaussian(rng) * cfg.vol * price;
    const close = Math.max(0.01, open + drift + shock);
    const wick = Math.abs(shock) * (0.6 + rng() * 1.4);
    const high = Math.max(open, close) + wick * rng();
    const low = Math.min(open, close) - wick * rng();
    const volFactor =
      timeframe === "1d" ? 1 : cfg.stepMs / MS.day;
    const volume = Math.round(
      avgDailyVol * volFactor * (0.5 + rng() * 1.5),
    );
    bars.push({
      timestamp: t,
      open: round(open, ref),
      high: round(Math.max(high, open, close), ref),
      low: round(Math.max(0.01, Math.min(low, open, close)), ref),
      close: round(close, ref),
      volume,
    });
    price = close;
  }
  return bars;
}

/** Sensible rounding: more decimals for low-priced stocks/FX. */
function round(v: number, ref: number): number {
  if (ref >= 1000) return Math.round(v * 100) / 100;
  if (ref >= 10) return Math.round(v * 100) / 100;
  return Math.round(v * 1000) / 1000;
}

/* ------------------------------ quotes ----------------------------- */

/**
 * Build a quote from the daily series plus a minute-seeded intraday jitter.
 * `delayMinutes` shifts the "as of" timestamp back (free-tier delayed feed).
 */
export function generateQuote(
  symbol: string,
  now: number = Date.now(),
  delayMinutes = 0,
): Quote {
  const inst = getInstrument(symbol);
  const ref = inst?.refPrice ?? 100;
  const asOf = now - delayMinutes * MS.minute;

  const daily = generateBars(symbol, "1d", now);
  const today = daily[daily.length - 1];
  const prev = daily[daily.length - 2] ?? today;
  const prevClose = prev.close;

  // Intraday jitter, stable within the current (delayed) minute.
  const minuteBucket = Math.floor(asOf / MS.minute);
  const jRng = mulberry32(hashSeed(`${symbol}:q:${minuteBucket}`));
  const intraday = gaussian(jRng) * 0.003 * today.close;
  const price = round(Math.max(0.01, today.close + intraday), ref);

  const change = round(price - prevClose, ref);
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;
  const dayHigh = Math.max(today.high, price);
  const dayLow = Math.min(today.low, price);

  return {
    symbol,
    price,
    change,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: today.volume,
    timestamp: asOf,
    delayed: delayMinutes > 0,
    delayMinutes,
    dayOpen: today.open,
    dayHigh: round(dayHigh, ref),
    dayLow: round(dayLow, ref),
    prevClose,
  };
}

/* --------------------------- fundamentals -------------------------- */

export function generateFundamentals(
  symbol: string,
  now: number = Date.now(),
): Fundamentals {
  const inst = getInstrument(symbol);
  const ref = inst?.refPrice ?? 100;
  const rng = mulberry32(hashSeed(`${symbol}:fund`));
  const quote = generateQuote(symbol, now);
  const daily = generateBars(symbol, "1d", now);
  const highs = daily.map((b) => b.high);
  const lows = daily.map((b) => b.low);

  const eps = round((ref / (8 + rng() * 14)) as number, ref);
  const peRatio = Math.round((quote.price / Math.max(eps, 0.01)) * 10) / 10;
  const shares = inst?.sharesOutstandingM ?? 1000;

  return {
    symbol,
    peRatio,
    dividendYield: Math.round((1.5 + rng() * 5.5) * 10) / 10,
    marketCap: Math.round(quote.price * shares * 1_000_000),
    eps,
    bookValue: round(ref * (0.6 + rng() * 0.8), ref),
    week52High: round(Math.max(...highs), ref),
    week52Low: round(Math.min(...lows), ref),
    beta: Math.round((0.6 + rng() * 1.1) * 100) / 100,
  };
}

/* ------------------------------ macro ------------------------------ */

const FREQ_STEP: Record<MacroSeriesDef["frequency"], number> = {
  monthly: 30 * MS.day,
  quarterly: 91 * MS.day,
  annual: 365 * MS.day,
};

const FREQ_POINTS: Record<MacroSeriesDef["frequency"], number> = {
  monthly: 60, // 5 years
  quarterly: 24, // 6 years
  annual: 12, // 12 years
};

/**
 * Generate a macro series backward from `now` toward the definition's baseline,
 * so the most recent point is `base`. Trend is per-year; noise is seeded.
 */
export function generateMacroSeries(
  def: MacroSeriesDef,
  now: number = Date.now(),
): MacroSeries {
  const step = FREQ_STEP[def.frequency];
  const count = FREQ_POINTS[def.frequency];
  const rng = mulberry32(hashSeed(`macro:${def.id}`));
  const yearsPerStep = step / (365 * MS.day);

  const points: MacroPoint[] = [];
  // Walk forward from oldest to newest, ending near `base`.
  let value = def.base - def.trend * yearsPerStep * count;
  for (let i = count; i >= 0; i--) {
    const t = now - i * step;
    value += def.trend * yearsPerStep + gaussian(rng) * def.volatility;
    let v = value;
    if (def.min !== undefined) v = Math.max(def.min, v);
    if (def.max !== undefined) v = Math.min(def.max, v);
    points.push({ timestamp: t, value: Math.round(v * 100) / 100 });
  }
  return {
    id: def.id,
    name: def.name,
    unit: def.unit,
    frequency: def.frequency,
    source: def.source,
    dataPoints: points,
  };
}

/** Normalized (base-100) performance series for an instrument over `days`. */
export function generateNormalizedPerf(
  inst: Instrument,
  days: number,
  now: number = Date.now(),
): MacroPoint[] {
  const rng = mulberry32(hashSeed(`${inst.symbol}:norm:${dayBucket(now)}`));
  const points: MacroPoint[] = [];
  let v = 100;
  for (let i = days; i >= 0; i--) {
    v += gaussian(rng) * 0.9 + 0.03;
    points.push({
      timestamp: now - i * MS.day,
      value: Math.round(v * 100) / 100,
    });
  }
  return points;
}
