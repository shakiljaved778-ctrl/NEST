/**
 * Analytics abstraction. v1 logs to the console only — NO external calls are
 * made. Swap {@link ConsoleAnalytics} for a Segment/PostHog/GA client later by
 * implementing {@link Analytics}. Event names are a closed union so call sites
 * stay consistent.
 */
export type AnalyticsEventName =
  | "view_dashboard"
  | "view_symbol"
  | "view_macro"
  | "view_portfolio"
  | "add_holding"
  | "create_portfolio"
  | "hit_free_limit"
  | "click_upgrade"
  | "sign_up"
  | "log_in"
  | "complete_onboarding"
  | "create_alert";

export interface Analytics {
  track(event: AnalyticsEventName, props?: Record<string, unknown>): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
}

export class ConsoleAnalytics implements Analytics {
  track(event: AnalyticsEventName, props: Record<string, unknown> = {}): void {
    // eslint-disable-next-line no-console
    console.info(`[analytics] ${event}`, props);
  }
  identify(userId: string, traits: Record<string, unknown> = {}): void {
    // eslint-disable-next-line no-console
    console.info(`[analytics] identify ${userId}`, traits);
  }
}

let instance: Analytics | null = null;
export function getAnalytics(): Analytics {
  if (!instance) instance = new ConsoleAnalytics();
  return instance;
}
