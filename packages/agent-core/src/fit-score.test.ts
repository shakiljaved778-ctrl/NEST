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

  it("the input type structurally rejects a supplier-margin field (compile-time moat)", () => {
    // @ts-expect-error — margin/commission/sponsorship are not FitScoreInput fields
    const _rejected: FitScoreInput = { ...base, margin: 0.99, sponsoredBid: 999999 };
    void _rejected;
  });

  it("a smuggled supplier-margin field cannot change the score at runtime", () => {
    const clean = fitScore(base);
    // Force margin/sponsorship onto the object at runtime; parse must strip it.
    const dirty = fitScore({ ...base, margin: 0.99, sponsoredBid: 999999 } as unknown as FitScoreInput);
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
