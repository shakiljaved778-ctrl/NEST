import { describe, expect, it } from "vitest";
import { DEFAULT_GOALS } from "@/lib/defaults";
import {
  computeStreaks,
  daysBefore,
  scoreDay,
  totalAiSessions,
  weekSummary,
  weightTrend,
} from "@/lib/scoring";
import { emptyCheckin } from "@/lib/storage";
import { DailyCheckin, Goals } from "@/lib/types";

const goals: Goals = { ...DEFAULT_GOALS, weeklySavingsTarget: 700, workoutMinutesPerDay: 30 };

function perfectDay(date: string): DailyCheckin {
  return {
    ...emptyCheckin(date),
    careerAction: true,
    linkedinPosted: true,
    linkedinEngagements: 3,
    chapterRead: true,
    workoutMinutes: 30,
    aiLearningDone: true,
    savedAmount: 100, // daily target = 700/7 = 100
  };
}

describe("scoreDay", () => {
  it("scores a perfect day 100", () => {
    expect(scoreDay(perfectDay("2026-07-14"), goals).total).toBe(100);
  });

  it("scores an empty day 0", () => {
    expect(scoreDay(emptyCheckin("2026-07-14"), goals).total).toBe(0);
  });

  it("gives partial fitness credit", () => {
    const c = { ...emptyCheckin("2026-07-14"), workoutMinutes: 15 };
    const fitness = scoreDay(c, goals).tracks.find((t) => t.track === "fitness")!;
    expect(fitness.score).toBe(50);
    expect(fitness.done).toBe(false);
  });

  it("weights a LinkedIn post at 70 and engagement at 30", () => {
    const posted = { ...emptyCheckin("2026-07-14"), linkedinPosted: true };
    const li = scoreDay(posted, goals).tracks.find((t) => t.track === "linkedin")!;
    expect(li.score).toBe(70);
    const engaged = { ...posted, linkedinEngagements: 3 };
    expect(scoreDay(engaged, goals).tracks.find((t) => t.track === "linkedin")!.score).toBe(100);
  });

  it("caps finance score at the daily target", () => {
    const c = { ...emptyCheckin("2026-07-14"), savedAmount: 10000 };
    expect(scoreDay(c, goals).tracks.find((t) => t.track === "finance")!.score).toBe(100);
  });
});

describe("daysBefore", () => {
  it("handles month boundaries", () => {
    expect(daysBefore("2026-07-01", 1)).toBe("2026-06-30");
    expect(daysBefore("2026-01-01", 1)).toBe("2025-12-31");
  });
});

describe("computeStreaks", () => {
  const today = "2026-07-14";

  it("counts consecutive good days ending today", () => {
    const history = [perfectDay("2026-07-12"), perfectDay("2026-07-13"), perfectDay(today)];
    expect(computeStreaks(history, goals, today).overall).toBe(3);
  });

  it("does not break yesterday's streak when today is unlogged", () => {
    const history = [perfectDay("2026-07-12"), perfectDay("2026-07-13")];
    expect(computeStreaks(history, goals, today).overall).toBe(2);
  });

  it("breaks the streak on a gap day", () => {
    const history = [perfectDay("2026-07-11"), perfectDay("2026-07-13"), perfectDay(today)];
    expect(computeStreaks(history, goals, today).overall).toBe(2);
  });

  it("tracks per-track streaks independently", () => {
    const readOnly = { ...emptyCheckin(today), chapterRead: true };
    const streaks = computeStreaks([readOnly], goals, today);
    expect(streaks.byTrack.reading).toBe(1);
    expect(streaks.byTrack.fitness).toBe(0);
  });

  it("computes best-ever streak from history", () => {
    const history = [
      perfectDay("2026-07-01"),
      perfectDay("2026-07-02"),
      perfectDay("2026-07-03"),
      perfectDay("2026-07-10"),
    ];
    expect(computeStreaks(history, goals, today).bestOverall).toBe(3);
  });
});

describe("weightTrend", () => {
  it("returns nulls with no weigh-ins", () => {
    expect(weightTrend([emptyCheckin("2026-07-14")], "2026-07-14")).toEqual({
      current: null,
      weekChange: null,
    });
  });

  it("computes weekly change against a weigh-in 7+ days back", () => {
    const history = [
      { ...emptyCheckin("2026-07-01"), weightKg: 90 },
      { ...emptyCheckin("2026-07-14"), weightKg: 88.5 },
    ];
    expect(weightTrend(history, "2026-07-14")).toEqual({ current: 88.5, weekChange: -1.5 });
  });
});

describe("weekSummary / totalAiSessions", () => {
  it("aggregates only the trailing 7 days", () => {
    const history = [
      perfectDay("2026-07-01"), // outside window
      perfectDay("2026-07-08"), // window starts 07-08 for today 07-14
      perfectDay("2026-07-14"),
    ];
    const week = weekSummary(history, goals, "2026-07-14");
    expect(week.daysLogged).toBe(2);
    expect(week.posts).toBe(2);
    expect(week.saved).toBe(200);
    expect(totalAiSessions(history)).toBe(3);
  });
});
