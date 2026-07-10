import { describe, expect, it } from "vitest";
import { computeQualityScore, signalsForProvider, type QualitySignals } from "../lib/quality";
import { PROVIDERS } from "../lib/providers";

const strong: QualitySignals = {
  rating: 4.9,
  checklistCompletion: 0.98,
  photoCompliance: 0.95,
  chatSentiment: 0.6,
  repeatRate: 0.55,
  refundRate: 0.01,
  onTimeRate: 0.96,
};

const weak: QualitySignals = {
  rating: 3.6,
  checklistCompletion: 0.6,
  photoCompliance: 0.4,
  chatSentiment: -0.3,
  repeatRate: 0.05,
  refundRate: 0.2,
  onTimeRate: 0.55,
};

describe("computeQualityScore", () => {
  it("scores a strong provider as excellent with no flags", () => {
    const q = computeQualityScore(strong);
    expect(q.score).toBeGreaterThanOrEqual(85);
    expect(q.band).toBe("excellent");
    expect(q.flags).toEqual([]);
  });

  it("scores a weak provider low with actionable flags", () => {
    const q = computeQualityScore(weak);
    expect(q.score).toBeLessThan(50);
    expect(q.band).toBe("at_risk");
    expect(q.flags).toContain("rating_below_4_3_weekly_review");
    expect(q.flags).toContain("refund_rate_above_10pct");
    expect(q.flags).toContain("retraining_or_offboarding_review");
  });

  it("keeps scores in 0–100 even on out-of-range inputs", () => {
    const q = computeQualityScore({
      rating: 6,
      checklistCompletion: 2,
      photoCompliance: -1,
      chatSentiment: 5,
      repeatRate: 3,
      refundRate: -2,
      onTimeRate: 9,
    });
    expect(q.score).toBeGreaterThanOrEqual(0);
    expect(q.score).toBeLessThanOrEqual(100);
  });

  it("breakdown sums to the score (within rounding)", () => {
    const q = computeQualityScore(strong);
    const sum = Object.values(q.breakdown).reduce((a, b) => a + b, 0) * 100;
    expect(Math.abs(sum - q.score)).toBeLessThanOrEqual(1);
  });

  it("flags low photo and checklist compliance individually", () => {
    const q = computeQualityScore({ ...strong, photoCompliance: 0.5, checklistCompletion: 0.7 });
    expect(q.flags).toContain("photo_documentation_low");
    expect(q.flags).toContain("checklist_completion_low");
  });
});

describe("signalsForProvider", () => {
  it("derives signals for every seed provider without errors", () => {
    for (const p of PROVIDERS) {
      const s = signalsForProvider(p, []);
      expect(s.rating).toBeGreaterThan(0);
      const q = computeQualityScore(s);
      expect(q.score).toBeGreaterThan(0);
    }
  });
});
