import { describe, it, expect } from "vitest";
import { fitScore } from "./fit-score.js";
import type { FitScoreInput } from "@voyara/contracts";

const base: FitScoreInput = {
  tasteMatch: 0.8,
  priceVsBudget: 0.7,
  location: 0.9,
  reviews: 0.85,
  scheduleQuality: 1,
};

describe("fit scorer margin-blindness (the trust moat)", () => {
  it("produces a stable 0..1 score from fit signals only", () => {
    const r = fitScore(base);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("a smuggled supplier-margin field cannot change the score", () => {
    const clean = fitScore(base);
    // Force a margin/commission field onto the input at runtime.
    const dirty = fitScore({
      ...base,
      // @ts-expect-error — margin is not part of FitScoreInput and must be rejected
      margin: 0.99,
      // @ts-expect-error — sponsorship is likewise not a scoring signal
      sponsoredBid: 999999,
    });
    expect(dirty.score).toBe(clean.score);
  });

  it("weights contain no margin/sponsorship key", () => {
    const r = fitScore(base);
    const keys = Object.keys(r.weights);
    expect(keys).not.toContain("margin");
    expect(keys).not.toContain("commission");
    expect(keys).not.toContain("sponsoredBid");
  });
});
