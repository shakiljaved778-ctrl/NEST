import { describe, expect, it } from "vitest";
import { matchProviders, PROVIDERS } from "../lib/providers";

describe("matchProviders", () => {
  it("only returns providers with the requested skill", () => {
    const results = matchProviders({ serviceId: "ac-technician", zoneId: "west-bay" });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.provider.skills).toContain("ac-technician");
  });

  it("returns at most `limit` results, ranked by descending score", () => {
    const results = matchProviders({ serviceId: "house-cleaning", zoneId: "the-pearl" }, 2);
    expect(results.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("hard-filters by gender preference", () => {
    const results = matchProviders({
      serviceId: "house-cleaning",
      zoneId: "the-pearl",
      genderPreference: "female",
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.provider.gender).toBe("female");
  });

  it("ranks in-zone providers above equally-skilled out-of-zone providers", () => {
    // Suresh (p7) and Ramesh (p1) are both AC techs; only p1 covers west-bay.
    const results = matchProviders({ serviceId: "ac-technician", zoneId: "west-bay" }, 10);
    const p1 = results.find((r) => r.provider.id === "p1")!;
    const p7 = results.find((r) => r.provider.id === "p7")!;
    expect(p1.breakdown.distance).toBeGreaterThan(p7.breakdown.distance);
  });

  it("penalises slow responders on urgent jobs", () => {
    const calm = matchProviders({ serviceId: "deep-cleaning", zoneId: "lusail" }, 10);
    const urgent = matchProviders({ serviceId: "deep-cleaning", zoneId: "lusail", urgent: true }, 10);
    // John Dela Cruz (p9) responds in 11 min — availability halves when urgent.
    const calmP9 = calm.find((r) => r.provider.id === "p9")!;
    const urgentP9 = urgent.find((r) => r.provider.id === "p9")!;
    expect(urgentP9.breakdown.availability).toBeLessThan(calmP9.breakdown.availability);
  });

  it("boosts language match", () => {
    const results = matchProviders({ serviceId: "plumbing", zoneId: "al-sadd", language: "ar" }, 10);
    const arabicSpeaker = results.find((r) => r.provider.languages.includes("ar"))!;
    const nonSpeaker = results.find((r) => !r.provider.languages.includes("ar"));
    expect(arabicSpeaker.breakdown.language).toBeCloseTo(0.05);
    if (nonSpeaker) expect(nonSpeaker.breakdown.language).toBeCloseTo(0.02);
  });

  it("uses the blueprint weights — breakdown sums to the score", () => {
    const [top] = matchProviders({ serviceId: "electrical", zoneId: "west-bay" });
    const sum = Object.values(top.breakdown).reduce((a, b) => a + b, 0);
    expect(top.score).toBeCloseTo(sum, 1);
  });

  it("caps every weighted component at its blueprint weight", () => {
    const results = matchProviders({ serviceId: "nanny", zoneId: "the-pearl", genderPreference: "female" }, 10);
    const caps: Record<string, number> = {
      distance: 0.2,
      availability: 0.2,
      skill: 0.2,
      rating: 0.15,
      completion: 0.1,
      response: 0.05,
      language: 0.05,
      preference: 0.05,
    };
    for (const r of results) {
      for (const [k, v] of Object.entries(r.breakdown)) {
        expect(v).toBeLessThanOrEqual(caps[k] + 1e-9);
      }
    }
  });

  it("returns an empty list when no provider has the skill", () => {
    expect(matchProviders({ serviceId: "space-elevator-repair", zoneId: "lusail" })).toEqual([]);
  });

  it("seed network is fully verified (trust-first marketplace)", () => {
    expect(PROVIDERS.every((p) => p.verified)).toBe(true);
  });
});
