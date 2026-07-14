import {
  DailyCheckin,
  DayScore,
  Goals,
  Streaks,
  TrackKey,
  TrackScore,
} from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Score a single day's check-in against the goals, per track and overall. */
export function scoreDay(checkin: DailyCheckin, goals: Goals): DayScore {
  const tracks: TrackScore[] = [
    {
      track: "career",
      done: checkin.careerAction,
      score: checkin.careerAction ? 100 : 0,
      detail: checkin.careerAction
        ? checkin.careerNote || "Deliberate career action taken"
        : "No deliberate career action logged",
    },
    scoreLinkedin(checkin, goals),
    {
      track: "reading",
      done: checkin.chapterRead,
      score: checkin.chapterRead ? 100 : 0,
      detail: checkin.chapterRead
        ? checkin.chapterNote || "Chapter read"
        : "No chapter read today",
    },
    scoreFitness(checkin, goals),
    {
      track: "aiLearning",
      done: checkin.aiLearningDone,
      score: checkin.aiLearningDone ? 100 : 0,
      detail: checkin.aiLearningDone
        ? checkin.aiTopic || "AI learning session done"
        : "No AI learning session",
    },
    scoreFinance(checkin, goals),
  ];

  const total = Math.round(tracks.reduce((s, t) => s + t.score, 0) / tracks.length);
  return { date: checkin.date, total, tracks };
}

function scoreLinkedin(checkin: DailyCheckin, goals: Goals): TrackScore {
  const postPart = checkin.linkedinPosted ? 70 : 0;
  const engagementPart =
    goals.linkedinEngagementsPerDay > 0
      ? clamp(checkin.linkedinEngagements / goals.linkedinEngagementsPerDay, 0, 1) * 30
      : 30;
  const score = Math.round(postPart + engagementPart);
  return {
    track: "linkedin",
    done: checkin.linkedinPosted,
    score,
    detail: checkin.linkedinPosted
      ? `Posted, ${checkin.linkedinEngagements} engagement(s)`
      : `No post, ${checkin.linkedinEngagements} engagement(s)`,
  };
}

function scoreFitness(checkin: DailyCheckin, goals: Goals): TrackScore {
  const target = Math.max(goals.workoutMinutesPerDay, 1);
  const score = Math.round(clamp(checkin.workoutMinutes / target, 0, 1) * 100);
  return {
    track: "fitness",
    done: checkin.workoutMinutes >= target,
    score,
    detail: `${checkin.workoutMinutes}/${target} min` +
      (checkin.weightKg != null ? ` · weighed ${checkin.weightKg} kg` : ""),
  };
}

function scoreFinance(checkin: DailyCheckin, goals: Goals): TrackScore {
  const dailyTarget = goals.weeklySavingsTarget / 7;
  const score =
    dailyTarget > 0
      ? Math.round(clamp(checkin.savedAmount / dailyTarget, 0, 1) * 100)
      : checkin.savedAmount > 0
        ? 100
        : 0;
  return {
    track: "finance",
    done: checkin.savedAmount >= dailyTarget && dailyTarget > 0,
    score,
    detail: `${checkin.savedAmount} ${goals.currency} saved (daily target ~${Math.round(dailyTarget)})`,
  };
}

const isTrackDone = (checkin: DailyCheckin, goals: Goals, track: TrackKey): boolean =>
  scoreDay(checkin, goals).tracks.find((t) => t.track === track)!.done;

/** ISO date string N days before the given ISO date. */
export function daysBefore(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Current streaks counted back from `today`. A day only extends a streak
 * if a check-in exists and the track's daily target was met.
 */
export function computeStreaks(
  history: DailyCheckin[],
  goals: Goals,
  today: string
): Streaks {
  const byDate = new Map(history.map((c) => [c.date, c]));
  const trackKeys: TrackKey[] = [
    "career",
    "linkedin",
    "reading",
    "fitness",
    "aiLearning",
    "finance",
  ];

  const byTrack = {} as Record<TrackKey, number>;
  for (const track of trackKeys) {
    let streak = 0;
    for (let i = 0; ; i++) {
      const c = byDate.get(daysBefore(today, i));
      if (!c || !isTrackDone(c, goals, track)) {
        // Today not being logged yet shouldn't break yesterday's streak.
        if (i === 0 && !c) continue;
        break;
      }
      streak++;
      if (i > 3660) break;
    }
    byTrack[track] = streak;
  }

  let overall = 0;
  for (let i = 0; ; i++) {
    const c = byDate.get(daysBefore(today, i));
    const good = c && scoreDay(c, goals).total >= 60;
    if (!good) {
      if (i === 0 && !c) continue;
      break;
    }
    overall++;
    if (i > 3660) break;
  }

  let bestOverall = 0;
  let run = 0;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  let prev: string | null = null;
  for (const c of sorted) {
    const good = scoreDay(c, goals).total >= 60;
    const consecutive = prev !== null && daysBefore(c.date, 1) === prev;
    run = good ? (consecutive ? run + 1 : 1) : 0;
    bestOverall = Math.max(bestOverall, run);
    prev = c.date;
  }

  return { overall, byTrack, bestOverall };
}

/** Latest known weight on/before today, and the trend vs ~7 days earlier. */
export function weightTrend(
  history: DailyCheckin[],
  today: string
): { current: number | null; weekChange: number | null } {
  const weighed = history
    .filter((c) => c.weightKg != null && c.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (weighed.length === 0) return { current: null, weekChange: null };
  const current = weighed[0].weightKg!;
  const weekAgoCutoff = daysBefore(weighed[0].date, 7);
  const past = weighed.find((c) => c.date <= weekAgoCutoff);
  return {
    current,
    weekChange: past ? Math.round((current - past.weightKg!) * 10) / 10 : null,
  };
}

/** Totals for the last 7 days ending at `today` (inclusive). */
export function weekSummary(history: DailyCheckin[], goals: Goals, today: string) {
  const cutoff = daysBefore(today, 6);
  const week = history.filter((c) => c.date >= cutoff && c.date <= today);
  const scored = week.map((c) => scoreDay(c, goals));
  return {
    daysLogged: week.length,
    avgScore: scored.length
      ? Math.round(scored.reduce((s, d) => s + d.total, 0) / scored.length)
      : 0,
    posts: week.filter((c) => c.linkedinPosted).length,
    chapters: week.filter((c) => c.chapterRead).length,
    workoutMinutes: week.reduce((s, c) => s + c.workoutMinutes, 0),
    aiSessions: week.filter((c) => c.aiLearningDone).length,
    saved: week.reduce((s, c) => s + c.savedAmount, 0),
    careerActions: week.filter((c) => c.careerAction).length,
  };
}

/** Total AI sessions ever completed — drives the curriculum position. */
export function totalAiSessions(history: DailyCheckin[]): number {
  return history.filter((c) => c.aiLearningDone).length;
}
