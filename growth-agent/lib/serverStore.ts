import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_GOALS } from "./defaults";
import { DailyCheckin, Goals } from "./types";

/**
 * File-backed store so the server (daily digest cron) can see the same
 * data as the browser. The client mirrors every save here best-effort;
 * localStorage remains the UI's source of truth.
 */
const DATA_FILE = path.join(process.cwd(), "data", "store.json");

export interface Store {
  goals: Goals;
  history: DailyCheckin[];
}

export async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      goals: { ...DEFAULT_GOALS, ...(parsed.goals ?? {}) },
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { goals: DEFAULT_GOALS, history: [] };
  }
}

export async function writeStore(partial: Partial<Store>): Promise<Store> {
  const current = await readStore();
  const next: Store = {
    goals: { ...current.goals, ...(partial.goals ?? {}) },
    history: Array.isArray(partial.history) ? partial.history : current.history,
  };
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
