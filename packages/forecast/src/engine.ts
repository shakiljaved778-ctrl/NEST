import {
  type NormalizedOffer,
  type ForecastResult,
  type ForecastPoint,
  type FreezeQuote,
  type Money,
  money,
  bpsOf,
} from "@voyara/contracts";

/**
 * v1 forecast: a deterministic heuristic + statistical model over day-of-week
 * seasonality, a days-to-departure curve, and per-offer volatility. The
 * ForecastEngine interface is designed so a real ML model can replace this
 * without touching callers.
 */
export interface ForecastEngine {
  forecast(offer: NormalizedOffer, opts: ForecastOpts): ForecastResult;
  quoteFreeze(offer: NormalizedOffer, opts: FreezeOpts): FreezeQuote;
}

export interface ForecastOpts {
  /** Days between "now" and travel. Fewer days => less room to fall. */
  daysToDeparture: number;
  /** Anchor date for the forward curve (ISO). Defaults to today. */
  now?: Date;
}

export interface FreezeOpts {
  daysToDeparture: number;
  /** Exposure cap as a fraction of fare. Config default 0.15 (15%). */
  exposureCapFraction?: number;
  /** Hard ceiling on exposure fraction per fare class. */
  maxExposureFraction?: number;
  freezeWindowHours?: number;
  now?: Date;
}

const DOW_SEASONALITY = [0.98, 0.97, 0.99, 1.0, 1.03, 1.06, 1.04]; // Sun..Sat

/** Deterministic pseudo-volatility in [0.02, 0.18] derived from the offer id. */
export function offerVolatility(offer: NormalizedOffer): number {
  let h = 0;
  for (const ch of offer.id) h = (h * 31 + ch.charCodeAt(0)) % 100_000;
  return 0.02 + (h % 160) / 1000; // 0.02 .. 0.179
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export class HeuristicForecastEngine implements ForecastEngine {
  forecast(offer: NormalizedOffer, opts: ForecastOpts): ForecastResult {
    const now = opts.now ?? new Date();
    const base = offer.price.amountMinor;
    const vol = offerVolatility(offer);
    const days = Math.max(0, opts.daysToDeparture);

    // Prices tend to rise as departure nears; more room to fall when far out.
    const driftPerDay = -vol * 0.35; // negative => expected to fall while far out
    const curve: ForecastPoint[] = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(now, i);
      const dow = DOW_SEASONALITY[date.getUTCDay()] ?? 1;
      const horizon = Math.max(0, days - i);
      const drift = 1 + driftPerDay * Math.min(horizon, 14) * 0.01;
      const expected = Math.round(base * dow * drift);
      curve.push({ date: isoDate(date), expectedPriceMinor: expected });
    }

    // Verdict: if the near-term curve is expected to fall meaningfully and we
    // still have runway, WAIT; otherwise BUY.
    const soon = curve[3]?.expectedPriceMinor ?? base;
    const expectedDropBps = ((base - soon) / base) * 10_000;
    const hasRunway = days >= 5;
    const willFall = expectedDropBps > 150 && hasRunway; // >1.5% expected drop

    const verdict = willFall ? "WAIT" : "BUY";
    // Confidence rises with runway certainty and falls with volatility.
    const confidence = clamp01(
      (verdict === "BUY" ? 0.62 : 0.55) + (0.14 - vol) - Math.abs(0.5 - days / 60),
    );

    const rationale = willFall
      ? `Fare volatility ${(vol * 100).toFixed(1)}% with ${days}d runway; near-term curve dips ~${(expectedDropBps / 100).toFixed(1)}%. Waiting is favored.`
      : `Low remaining runway (${days}d) and firm near-term curve; locking now avoids upside risk.`;

    return { verdict, confidence: round2(confidence), curve, rationale };
  }

  quoteFreeze(offer: NormalizedOffer, opts: FreezeOpts): FreezeQuote {
    const now = opts.now ?? new Date();
    const capFraction = opts.exposureCapFraction ?? 0.15;
    const maxFraction = opts.maxExposureFraction ?? 0.25;
    const effectiveCapFraction = Math.min(capFraction, maxFraction);

    const vol = offerVolatility(offer);
    const days = Math.max(1, opts.daysToDeparture);
    const windowHours = opts.freezeWindowHours ?? 24;

    // Fee grows with volatility, runway, and window length; bounded by the cap.
    const feeFractionRaw = vol * (0.6 + days / 90) * (windowHours / 24) * 0.5;
    const feeFraction = Math.min(feeFractionRaw, effectiveCapFraction);
    const feeBps = Math.round(feeFraction * 10_000);

    const fee: Money = bpsOf(offer.price, feeBps);
    const exposureCap: Money = bpsOf(
      offer.price,
      Math.round(effectiveCapFraction * 10_000),
    );

    return {
      offerHash: hashOffer(offer),
      lockedPrice: offer.price,
      fee: money(Math.max(fee.amountMinor, 100), fee.currency), // floor 1.00
      exposureCap,
      expiresAt: new Date(now.getTime() + windowHours * 3600_000).toISOString(),
    };
  }
}

function hashOffer(offer: NormalizedOffer): string {
  return `${offer.supplierRef}:${offer.id}:${offer.price.amountMinor}`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
