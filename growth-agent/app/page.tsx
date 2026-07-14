"use client";

import { useEffect, useState } from "react";
import CheckinForm from "@/components/CheckinForm";
import CoachPanel from "@/components/CoachPanel";
import Dashboard from "@/components/Dashboard";
import GoalsForm from "@/components/GoalsForm";
import Library from "@/components/Library";
import { DEFAULT_GOALS } from "@/lib/defaults";
import {
  emptyCheckin,
  loadGoals,
  loadHistory,
  saveGoals,
  saveHistory,
  todayIso,
  upsertCheckin,
} from "@/lib/storage";
import { DailyCheckin, Goals } from "@/lib/types";

type Tab = "today" | "checkin" | "coach" | "library" | "goals";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "checkin", label: "Check-in" },
  { key: "coach", label: "Coach" },
  { key: "library", label: "Library" },
  { key: "goals", label: "Goals" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [history, setHistory] = useState<DailyCheckin[]>([]);
  const [ready, setReady] = useState(false);
  const today = todayIso();

  useEffect(() => {
    setGoals(loadGoals());
    setHistory(loadHistory());
    setReady(true);
  }, []);

  const handleSaveCheckin = (checkin: DailyCheckin) => {
    const next = upsertCheckin(history, checkin);
    setHistory(next);
    saveHistory(next);
  };

  const handleSaveGoals = (g: Goals) => {
    setGoals(g);
    saveGoals(g);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-3 py-6">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Personal Growth Agent
          </div>
          <h1 className="font-display text-3xl font-bold text-ink">
            Six tracks. One better day.
          </h1>
          <p className="mt-1 text-sm text-inkSoft">
            Career · LinkedIn · Reading · Fitness · AI learning · Finance — daily updates to{" "}
            <span className="font-medium text-ink">{goals.email}</span>
          </p>
        </div>
      </header>

      <nav className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-ink text-white" : "bg-white text-inkSoft shadow-card hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {!ready ? (
        <div className="py-20 text-center text-sm text-inkSoft">Loading your data…</div>
      ) : (
        <>
          {tab === "today" && <Dashboard goals={goals} history={history} today={today} />}
          {tab === "checkin" && (
            <CheckinForm
              key={today + history.length}
              goals={goals}
              initial={history.find((c) => c.date === today) ?? emptyCheckin(today)}
              onSave={handleSaveCheckin}
            />
          )}
          {tab === "coach" && <CoachPanel goals={goals} history={history} today={today} />}
          {tab === "library" && <Library goals={goals} history={history} />}
          {tab === "goals" && <GoalsForm key={JSON.stringify(goals)} goals={goals} onSave={handleSaveGoals} />}
        </>
      )}
    </div>
  );
}
