import { describe, expect, it } from "vitest";
import { RuleBasedCoach } from "@/lib/coach";
import { buildDigest } from "@/lib/emailDigest";
import { DEFAULT_GOALS } from "@/lib/defaults";
import { emptyCheckin } from "@/lib/storage";
import { DailyCheckin } from "@/lib/types";

const coach = new RuleBasedCoach();
const today = "2026-07-14";

describe("dailyBriefing", () => {
  it("produces advice for all six tracks", () => {
    const b = coach.dailyBriefing({ goals: DEFAULT_GOALS, history: [], today });
    expect(b.trackAdvice).toHaveLength(6);
    expect(b.headline).toContain(DEFAULT_GOALS.name);
    expect(b.linkedinIdea.length).toBeGreaterThan(10);
    expect(b.chapterSuggestion.book).toContain("Atomic Habits");
    expect(b.aiLesson.topic.length).toBeGreaterThan(0);
    expect(b.financeTip.length).toBeGreaterThan(10);
  });

  it("is deterministic for the same date", () => {
    const a = coach.dailyBriefing({ goals: DEFAULT_GOALS, history: [], today });
    const b = coach.dailyBriefing({ goals: DEFAULT_GOALS, history: [], today });
    expect(a).toEqual(b);
  });

  it("advances the AI lesson as sessions complete", () => {
    const history: DailyCheckin[] = [
      { ...emptyCheckin("2026-07-12"), aiLearningDone: true },
      { ...emptyCheckin("2026-07-13"), aiLearningDone: true },
    ];
    const fresh = coach.dailyBriefing({ goals: DEFAULT_GOALS, history: [], today });
    const advanced = coach.dailyBriefing({ goals: DEFAULT_GOALS, history, today });
    expect(advanced.aiLesson.topic).not.toBe(fresh.aiLesson.topic);
  });

  it("celebrates a weight loss on pace", () => {
    const history: DailyCheckin[] = [
      { ...emptyCheckin("2026-07-01"), weightKg: 90 },
      { ...emptyCheckin("2026-07-14"), weightKg: 89 },
    ];
    const b = coach.dailyBriefing({ goals: DEFAULT_GOALS, history, today });
    const fitness = b.trackAdvice.find((a) => a.track === "fitness")!;
    expect(fitness.message).toContain("on plan");
  });
});

describe("reviewLinkedinPost", () => {
  it("rewards a well-structured post", () => {
    const post = [
      "We hit 1,000 bookings in Doha this month.",
      "",
      "12 months ago NEST was a sketch on a napkin.",
      "Today 85 verified technicians serve homes across 3 zones.",
      "",
      "The lesson: trust is built one checklist at a time.",
      "",
      "What's the worst home-service experience you've had? 👇",
      "",
      "#Qatar #startups #AI",
    ].join("\n");
    const fb = coach.reviewLinkedinPost(post);
    expect(fb.score).toBeGreaterThanOrEqual(80);
    expect(fb.strengths.length).toBeGreaterThanOrEqual(4);
  });

  it("flags a weak one-liner", () => {
    const fb = coach.reviewLinkedinPost("Great day at the office!");
    expect(fb.score).toBeLessThan(60);
    expect(fb.improvements.length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildDigest", () => {
  it("renders subject, text and html containing the six tracks", () => {
    const d = buildDigest(DEFAULT_GOALS, [], today);
    expect(d.subject).toContain(today);
    for (const label of ["Career", "LinkedIn", "reading", "Fitness", "AI", "Finance"]) {
      expect(d.text.toLowerCase()).toContain(label.toLowerCase());
    }
    expect(d.html).toContain("Scoreboard");
    expect(d.html).toContain("Today's plan");
  });

  it("escapes HTML in user-provided fields", () => {
    const goals = { ...DEFAULT_GOALS, name: "<script>alert(1)</script>" };
    const d = buildDigest(goals, [], today);
    expect(d.html).not.toContain("<script>alert(1)</script>");
  });
});
