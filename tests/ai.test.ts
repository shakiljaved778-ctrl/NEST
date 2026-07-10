import { describe, expect, it } from "vitest";
import { adminDailySummary, bookingAssistant, classifyComplaint } from "../lib/ai";

describe("bookingAssistant", () => {
  it("routes 'AC not cooling' to the AC service", () => {
    const r = bookingAssistant("My AC is not cooling");
    expect(r.suggestedServiceId).toBe("ac-technician");
    expect(r.suggestedPackageId).toBe("ac-service");
    expect(r.followUps?.length).toBeGreaterThan(0);
    expect(r.safetyEscalation).toBe(false);
  });

  it("understands Arabic keywords", () => {
    const r = bookingAssistant("المكيف لا يبرد");
    expect(r.suggestedServiceId).toBe("ac-technician");
  });

  it("flags safety guidance for electrical issues without giving DIY repair steps", () => {
    const r = bookingAssistant("There are sparks coming from the socket");
    expect(r.suggestedServiceId).toBe("electrical");
    expect(r.safetyEscalation).toBe(true);
    expect(r.reply.toLowerCase()).not.toMatch(/open the panel and|replace the wire yourself/);
  });

  it("escalates emergencies to humans and never books", () => {
    const r = bookingAssistant("I smell smoke, I think there is a fire in the kitchen");
    expect(r.safetyEscalation).toBe(true);
    expect(r.suggestedServiceId).toBeUndefined();
    expect(r.reply).toMatch(/999/);
  });

  it("emergency escalation wins even when a service keyword is present", () => {
    const r = bookingAssistant("fire near the AC unit");
    expect(r.safetyEscalation).toBe(true);
    expect(r.suggestedServiceId).toBeUndefined();
  });

  it("falls back to a catalog overview for unrecognised requests", () => {
    const r = bookingAssistant("hello there");
    expect(r.suggestedServiceId).toBeUndefined();
    expect(r.followUps?.length).toBeGreaterThan(0);
  });

  it("routes cleaning, plumbing and nanny requests", () => {
    expect(bookingAssistant("I need someone to clean my apartment").suggestedServiceId).toBe("house-cleaning");
    expect(bookingAssistant("water is leaking under the sink").suggestedServiceId).toBe("plumbing");
    expect(bookingAssistant("looking for a babysitter for Friday").suggestedServiceId).toBe("nanny");
  });
});

describe("classifyComplaint", () => {
  it("classifies safety concerns as critical with human escalation", () => {
    const c = classifyComplaint("The worker made me feel unsafe in my home");
    expect(c.category).toBe("safety_concern");
    expect(c.priority).toBe("critical");
    expect(c.humanEscalation).toBe(true);
  });

  it("safety outranks damage when both signals appear", () => {
    const c = classifyComplaint("He broke my vase and I felt threatened when I complained");
    expect(c.category).toBe("safety_concern");
  });

  it("classifies damage claims as high priority with escalation", () => {
    const c = classifyComplaint("The cleaner broke my glass table");
    expect(c.category).toBe("damage_claim");
    expect(c.priority).toBe("high");
    expect(c.humanEscalation).toBe(true);
    expect(c.refundRisk).toBeGreaterThan(0.5);
  });

  it("classifies payment issues", () => {
    const c = classifyComplaint("I was charged twice, I want a refund");
    expect(c.category).toBe("payment_issue");
    expect(c.humanEscalation).toBe(true);
  });

  it("classifies late arrival and incomplete jobs without escalation", () => {
    expect(classifyComplaint("provider was 40 minutes late").category).toBe("late_arrival");
    const inc = classifyComplaint("he left early and the job is unfinished");
    expect(inc.category).toBe("incomplete_job");
    expect(inc.humanEscalation).toBe(false);
  });

  it("classifies poor quality and provider behaviour", () => {
    expect(classifyComplaint("the flat is still dirty, poor quality work").category).toBe("poor_quality");
    expect(classifyComplaint("the technician was rude to my wife").category).toBe("provider_behavior");
  });

  it("defaults to neutral 'other' and truncates long summaries", () => {
    const long = "x".repeat(200);
    const c = classifyComplaint(long);
    expect(c.category).toBe("other");
    expect(c.sentiment).toBe("neutral");
    expect(c.summary.length).toBeLessThanOrEqual(140);
  });
});

describe("adminDailySummary", () => {
  const base = {
    bookingsToday: 24,
    gmvToday: 4820,
    completionRate: 0.94,
    topService: "AC technician",
    hotZone: "West Bay",
  };

  it("includes bookings, GMV and completion rate", () => {
    const s = adminDailySummary({ ...base, openComplaints: 2 });
    expect(s).toContain("24 bookings");
    expect(s).toContain("4,820");
    expect(s).toContain("94%");
  });

  it("raises a complaint warning above the SLA threshold", () => {
    expect(adminDailySummary({ ...base, openComplaints: 6 })).toContain("⚠");
    expect(adminDailySummary({ ...base, openComplaints: 2 })).not.toContain("⚠");
  });
});
