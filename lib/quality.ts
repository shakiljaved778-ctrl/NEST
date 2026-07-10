import type { Booking, Provider } from "./types";

/**
 * AI provider quality scoring (blueprint module 5).
 *
 * Blends rating, checklist completion, photo documentation, chat sentiment,
 * repeat rate, refund history and time-on-job into a 0–100 score with a band
 * used across the provider app (earnings dashboard) and admin (quality review).
 */

export interface QualitySignals {
  /** Average rating 1–5. */
  rating: number;
  /** Share of checklist items completed across jobs, 0–1. */
  checklistCompletion: number;
  /** Share of jobs with before/after photos, 0–1. */
  photoCompliance: number;
  /** Average chat sentiment, -1 (negative) … 1 (positive). */
  chatSentiment: number;
  /** Share of customers who rebooked this provider, 0–1. */
  repeatRate: number;
  /** Share of jobs that ended in a refund, 0–1. */
  refundRate: number;
  /** Share of jobs finished within the package duration, 0–1. */
  onTimeRate: number;
}

export interface QualityScore {
  score: number; // 0–100
  band: "excellent" | "good" | "needs_improvement" | "at_risk";
  breakdown: Record<keyof QualitySignals, number>;
  /** Actions surfaced to ops / the provider app. */
  flags: string[];
}

const WEIGHTS: Record<keyof QualitySignals, number> = {
  rating: 0.3,
  checklistCompletion: 0.15,
  photoCompliance: 0.1,
  chatSentiment: 0.1,
  repeatRate: 0.15,
  refundRate: 0.1, // inverted: fewer refunds = higher score
  onTimeRate: 0.1,
};

export function computeQualityScore(signals: QualitySignals): QualityScore {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const normalized: Record<keyof QualitySignals, number> = {
    rating: clamp01((signals.rating - 3) / 2), // 3.0→0 … 5.0→1
    checklistCompletion: clamp01(signals.checklistCompletion),
    photoCompliance: clamp01(signals.photoCompliance),
    chatSentiment: clamp01((signals.chatSentiment + 1) / 2),
    repeatRate: clamp01(signals.repeatRate),
    refundRate: clamp01(1 - signals.refundRate * 4), // 25%+ refunds → 0
    onTimeRate: clamp01(signals.onTimeRate),
  };

  const breakdown = Object.fromEntries(
    (Object.keys(WEIGHTS) as (keyof QualitySignals)[]).map((k) => [k, Math.round(normalized[k] * WEIGHTS[k] * 1000) / 1000]),
  ) as Record<keyof QualitySignals, number>;

  const score = Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0) * 100);

  const band: QualityScore["band"] =
    score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "needs_improvement" : "at_risk";

  const flags: string[] = [];
  if (signals.rating < 4.3) flags.push("rating_below_4_3_weekly_review");
  if (signals.refundRate > 0.1) flags.push("refund_rate_above_10pct");
  if (signals.photoCompliance < 0.7) flags.push("photo_documentation_low");
  if (signals.checklistCompletion < 0.8) flags.push("checklist_completion_low");
  if (band === "at_risk") flags.push("retraining_or_offboarding_review");

  return { score, band, breakdown, flags };
}

/** Derive quality signals for a provider from marketplace data (MVP heuristics). */
export function signalsForProvider(provider: Provider, bookings: Booking[]): QualitySignals {
  const jobs = bookings.filter((b) => b.providerId === provider.id && b.status === "completed");
  const rated = jobs.filter((b) => b.rating !== undefined);
  const rating = rated.length
    ? rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length
    : provider.rating;

  const byCustomer = new Map<string, number>();
  for (const b of jobs) byCustomer.set(b.customerName, (byCustomer.get(b.customerName) ?? 0) + 1);
  const repeatRate = byCustomer.size ? [...byCustomer.values()].filter((n) => n > 1).length / byCustomer.size : 0.3;

  return {
    rating,
    checklistCompletion: provider.completionRate,
    photoCompliance: 0.9, // photo uploads tracked per job in production
    chatSentiment: 0.4,
    repeatRate,
    refundRate: 0.02,
    onTimeRate: provider.completionRate,
  };
}
