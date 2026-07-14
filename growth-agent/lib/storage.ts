import { DEFAULT_GOALS } from "./defaults";
import { DailyCheckin, Goals } from "./types";

const GOALS_KEY = "growth-agent:goals:v1";
const HISTORY_KEY = "growth-agent:history:v1";

const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;

export function loadGoals(): Goals {
  if (!hasStorage()) return DEFAULT_GOALS;
  try {
    const raw = window.localStorage.getItem(GOALS_KEY);
    if (!raw) return DEFAULT_GOALS;
    return { ...DEFAULT_GOALS, ...(JSON.parse(raw) as Partial<Goals>) };
  } catch {
    return DEFAULT_GOALS;
  }
}

export function saveGoals(goals: Goals): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  syncToServer({ goals });
}

/**
 * Best-effort mirror to the file-backed server store so the daily email
 * cron sees the latest data. Failures are ignored — localStorage is the
 * UI's source of truth.
 */
function syncToServer(partial: { goals?: Goals; history?: DailyCheckin[] }): void {
  try {
    void fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }).catch(() => {});
  } catch {
    // ignore — offline or static export
  }
}

export function loadHistory(): DailyCheckin[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyCheckin[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Insert or replace the check-in for its date, kept sorted ascending. */
export function upsertCheckin(history: DailyCheckin[], checkin: DailyCheckin): DailyCheckin[] {
  const next = history.filter((c) => c.date !== checkin.date);
  next.push(checkin);
  next.sort((a, b) => a.date.localeCompare(b.date));
  return next;
}

export function saveHistory(history: DailyCheckin[]): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  syncToServer({ history });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptyCheckin(date: string): DailyCheckin {
  return {
    date,
    careerAction: false,
    careerNote: "",
    linkedinPosted: false,
    linkedinPostText: "",
    linkedinEngagements: 0,
    chapterRead: false,
    chapterNote: "",
    workoutMinutes: 0,
    weightKg: null,
    aiLearningDone: false,
    aiTopic: "",
    savedAmount: 0,
    notes: "",
  };
}
