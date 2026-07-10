/**
 * Analytics event pipeline (Phase 7 iteration engine).
 * Enforces the named event taxonomy from the product blueprint and computes
 * the weekly booking-funnel review: any step with >20% drop is flagged
 * "kill or fix". Production streams the same events to PostHog/Amplitude.
 */

export const EVENT_TAXONOMY = [
  "booking_started",
  "quote_viewed",
  "payment_succeeded",
  "rebook_tapped",
  "ai_assistant_booked",
  "provider_accepted",
  "job_completed",
  "rating_submitted",
  "complaint_filed",
  "subscription_started",
] as const;

export type EventName = (typeof EVENT_TAXONOMY)[number];

export interface AnalyticsEvent {
  id: number;
  name: EventName;
  /** Anonymous or customer identifier. */
  actor: string;
  properties: Record<string, string | number | boolean>;
  createdAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __nestEvents: AnalyticsEvent[] | undefined;
}

function events(): AnalyticsEvent[] {
  if (!globalThis.__nestEvents) globalThis.__nestEvents = [];
  return globalThis.__nestEvents;
}

export function trackEvent(name: string, actor: string, properties: Record<string, string | number | boolean> = {}): AnalyticsEvent {
  if (!(EVENT_TAXONOMY as readonly string[]).includes(name)) {
    throw new Error(`Unknown event "${name}" — use the named taxonomy: ${EVENT_TAXONOMY.join(", ")}`);
  }
  const e: AnalyticsEvent = {
    id: events().length + 1,
    name: name as EventName,
    actor,
    properties,
    createdAt: new Date().toISOString(),
  };
  events().push(e);
  return e;
}

export function listEvents(): AnalyticsEvent[] {
  return [...events()];
}

/** The golden-path funnel reviewed weekly. */
const FUNNEL_STEPS: EventName[] = ["booking_started", "quote_viewed", "payment_succeeded", "job_completed", "rating_submitted"];

export interface FunnelStep {
  step: EventName;
  actors: number;
  /** Conversion from the previous step (1 for the first step). */
  conversion: number;
  /** Blueprint rule: >20% drop from the previous step ⇒ kill or fix. */
  killOrFix: boolean;
}

export function funnelReview(): { steps: FunnelStep[]; healthy: boolean } {
  const actorsAt = FUNNEL_STEPS.map((step) => new Set(events().filter((e) => e.name === step).map((e) => e.actor)));

  const steps: FunnelStep[] = [];
  for (let i = 0; i < FUNNEL_STEPS.length; i++) {
    // Count only actors who also reached every earlier step (true funnel).
    let cohort = actorsAt[i];
    for (let j = 0; j < i; j++) cohort = new Set([...cohort].filter((a) => actorsAt[j].has(a)));
    const prev = i === 0 ? cohort.size : steps[i - 1].actors;
    const conversion = i === 0 ? 1 : prev === 0 ? 0 : cohort.size / prev;
    steps.push({
      step: FUNNEL_STEPS[i],
      actors: cohort.size,
      conversion: Math.round(conversion * 100) / 100,
      killOrFix: i > 0 && prev > 0 && conversion < 0.8,
    });
  }

  return { steps, healthy: steps.every((s) => !s.killOrFix) };
}
