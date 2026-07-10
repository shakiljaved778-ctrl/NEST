import { beforeEach, describe, expect, it } from "vitest";
import { EVENT_TAXONOMY, funnelReview, listEvents, trackEvent } from "../lib/analytics";

beforeEach(() => {
  globalThis.__nestEvents = undefined;
});

describe("event tracking", () => {
  it("accepts every event in the named taxonomy", () => {
    for (const name of EVENT_TAXONOMY) trackEvent(name, "u1");
    expect(listEvents()).toHaveLength(EVENT_TAXONOMY.length);
  });

  it("rejects unnamed events (taxonomy is enforced)", () => {
    expect(() => trackEvent("random_click", "u1")).toThrow(/Unknown event/);
  });

  it("stores actor and properties", () => {
    const e = trackEvent("booking_started", "u42", { serviceId: "plumbing", urgent: true });
    expect(e.actor).toBe("u42");
    expect(e.properties.serviceId).toBe("plumbing");
  });
});

describe("funnel review", () => {
  function walk(actor: string, throughStep: number) {
    const path = ["booking_started", "quote_viewed", "payment_succeeded", "job_completed", "rating_submitted"] as const;
    for (let i = 0; i <= throughStep; i++) trackEvent(path[i], actor);
  }

  it("is healthy when every step converts above 80%", () => {
    for (let i = 0; i < 10; i++) walk(`u${i}`, 4); // all 10 complete the funnel
    const { steps, healthy } = funnelReview();
    expect(healthy).toBe(true);
    expect(steps[0].actors).toBe(10);
    expect(steps[4].conversion).toBe(1);
  });

  it("flags a step with >20% drop as kill-or-fix", () => {
    for (let i = 0; i < 10; i++) walk(`u${i}`, 1); // 10 view a quote
    for (let i = 0; i < 5; i++) walk(`p${i}`, 4); // only 5 more make it all the way
    const { steps, healthy } = funnelReview();
    const payment = steps.find((s) => s.step === "payment_succeeded")!;
    expect(payment.killOrFix).toBe(true); // 15 → 5 is a 67% drop
    expect(healthy).toBe(false);
  });

  it("counts funnel cohorts, not raw event volume", () => {
    trackEvent("payment_succeeded", "stray"); // never started a booking
    walk("u1", 4);
    const { steps } = funnelReview();
    expect(steps.find((s) => s.step === "payment_succeeded")!.actors).toBe(1); // stray excluded
  });

  it("handles an empty funnel without dividing by zero", () => {
    const { steps, healthy } = funnelReview();
    expect(steps.every((s) => s.actors === 0)).toBe(true);
    expect(healthy).toBe(true);
  });
});
