import { describe, it, expect } from "vitest";
import { ruleMatches, type RoutingCriteria } from "@/lib/services/routing";

const lead = {
  source: "web-form",
  channel: "web",
  territory: "Doha North",
  productInterestId: "prod-1",
  score: 75,
};

describe("routing rule matching", () => {
  it("matches an empty criteria (fallback)", () => {
    expect(ruleMatches({}, lead)).toBe(true);
  });

  it("matches on source", () => {
    expect(ruleMatches({ sources: ["web-form", "webhook"] }, lead)).toBe(true);
    expect(ruleMatches({ sources: ["referral"] }, lead)).toBe(false);
  });

  it("matches on territory", () => {
    expect(ruleMatches({ territories: ["Doha North"] }, lead)).toBe(true);
    expect(ruleMatches({ territories: ["Al Wakrah"] }, lead)).toBe(false);
  });

  it("matches on product interest", () => {
    expect(ruleMatches({ productIds: ["prod-1"] }, lead)).toBe(true);
    expect(ruleMatches({ productIds: ["prod-9"] }, lead)).toBe(false);
  });

  it("matches on score range", () => {
    expect(ruleMatches({ minScore: 70 }, lead)).toBe(true);
    expect(ruleMatches({ minScore: 80 }, lead)).toBe(false);
    expect(ruleMatches({ maxScore: 80 }, lead)).toBe(true);
    expect(ruleMatches({ minScore: 70, maxScore: 80 }, lead)).toBe(true);
  });

  it("requires ALL criteria to match (AND semantics)", () => {
    const c: RoutingCriteria = { sources: ["web-form"], territories: ["Doha North"], minScore: 70 };
    expect(ruleMatches(c, lead)).toBe(true);
    expect(ruleMatches({ ...c, minScore: 90 }, lead)).toBe(false);
  });

  it("does not match when the lead is missing a required field", () => {
    expect(ruleMatches({ channels: ["events"] }, { ...lead, channel: null })).toBe(false);
    expect(ruleMatches({ territories: ["Doha North"] }, { ...lead, territory: null })).toBe(false);
  });
});
