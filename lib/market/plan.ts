/**
 * Freemium feature flags for the Qatar Market Dashboard.
 *
 * A single source of truth for what `free` vs `premium` can do. UI reads these
 * to render lock overlays / upgrade CTAs; the API reads them to decide quote
 * delay. Add real entitlement checks (Stripe/Paddle) behind {@link canUse}.
 */
import type { PlanTier } from "@/types/market";

export interface PlanFeatures {
  /** Minutes quotes are delayed. 0 = near real-time. */
  quoteDelayMinutes: number;
  /** Live streaming (SSE/WebSocket mock). */
  liveStreaming: boolean;
  /** Max indicators on a chart. */
  maxIndicators: number;
  /** Max portfolios the user can create. */
  maxPortfolios: number;
  /** Advanced portfolio analytics (risk, scenario). */
  advancedAnalytics: boolean;
  /** Price / % alerts. */
  alerts: boolean;
  /** GCC + global macro depth. */
  macroDepth: boolean;
  /** Deeper fundamentals. */
  deepFundamentals: boolean;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    quoteDelayMinutes: 15,
    liveStreaming: false,
    maxIndicators: 1,
    maxPortfolios: 1,
    advancedAnalytics: false,
    alerts: false,
    macroDepth: false,
    deepFundamentals: false,
  },
  premium: {
    quoteDelayMinutes: 0,
    liveStreaming: true,
    maxIndicators: 6,
    maxPortfolios: 10,
    advancedAnalytics: true,
    alerts: true,
    macroDepth: true,
    deepFundamentals: true,
  },
};

export function features(plan: PlanTier): PlanFeatures {
  return PLAN_FEATURES[plan];
}

/** Boolean gate for a single capability. */
export function canUse(plan: PlanTier, feature: keyof PlanFeatures): boolean {
  const val = PLAN_FEATURES[plan][feature];
  return typeof val === "boolean" ? val : val > 0;
}

/** Delay (minutes) applied to a plan's quotes. */
export function quoteDelay(plan: PlanTier): number {
  return PLAN_FEATURES[plan].quoteDelayMinutes;
}
