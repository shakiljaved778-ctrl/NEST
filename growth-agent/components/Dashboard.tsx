"use client";

import { scoreDay, computeStreaks, weekSummary, weightTrend, daysBefore } from "@/lib/scoring";
import { DailyCheckin, Goals, TRACKS } from "@/lib/types";
import TrendChart, { TrendPoint } from "./TrendChart";
import { Card, Stat } from "./ui";

export default function Dashboard({
  goals,
  history,
  today,
}: {
  goals: Goals;
  history: DailyCheckin[];
  today: string;
}) {
  const streaks = computeStreaks(history, goals, today);
  const week = weekSummary(history, goals, today);
  const weight = weightTrend(history, today);
  const todayCheckin = history.find((c) => c.date === today);
  const todayScore = todayCheckin ? scoreDay(todayCheckin, goals) : null;

  const cutoff = daysBefore(today, 13);
  const scoreTrend: TrendPoint[] = history
    .filter((c) => c.date >= cutoff && c.date <= today)
    .map((c) => ({ date: c.date, value: scoreDay(c, goals).total }));

  const weightPoints: TrendPoint[] = history
    .filter((c) => c.weightKg != null && c.date <= today)
    .slice(-30)
    .map((c) => ({ date: c.date, value: c.weightKg! }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Today's score"
          value={todayScore ? `${todayScore.total}/100` : "—"}
          sub={todayScore ? "logged" : "not logged yet"}
        />
        <Stat
          label="Streak"
          value={`${streaks.overall} day${streaks.overall === 1 ? "" : "s"}`}
          sub={`best: ${Math.max(streaks.bestOverall, streaks.overall)}`}
        />
        <Stat label="7-day average" value={`${week.avgScore}/100`} sub={`${week.daysLogged}/7 days logged`} />
        <Stat
          label="Weight"
          value={weight.current != null ? `${weight.current} kg` : "—"}
          sub={
            weight.weekChange != null
              ? `${weight.weekChange > 0 ? "+" : ""}${weight.weekChange} kg this week`
              : goals.targetWeightKg != null
                ? `target ${goals.targetWeightKg} kg`
                : "log a weigh-in"
          }
        />
      </div>

      <Card title="Today across the six tracks">
        {todayScore ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {todayScore.tracks.map((t) => {
              const meta = TRACKS.find((x) => x.key === t.track)!;
              return (
                <li
                  key={t.track}
                  className="flex items-center justify-between rounded-xl border border-mist bg-pearl px-3 py-2"
                >
                  <span className="text-sm text-ink">
                    {meta.emoji} {meta.label}
                    <span className="ml-2 text-xs text-inkSoft/70">{t.detail}</span>
                  </span>
                  <span
                    className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      t.done ? "bg-grove/10 text-groveDeep" : "bg-mist text-inkSoft"
                    }`}
                  >
                    {t.done ? "✓ done" : `${t.score}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-inkSoft">
            You haven&apos;t logged today yet. Open the <strong>Check-in</strong> tab — it takes two
            minutes.
          </p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Daily score — last 14 days">
          <TrendChart points={scoreTrend} color="#0E8A6D" unit="" />
        </Card>
        <Card title="Weight (kg) — last 30 weigh-ins">
          <TrendChart points={weightPoints} color="#A07E17" unit=" kg" />
        </Card>
      </div>

      <Card title="This week">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-ink md:grid-cols-3">
          <div>💼 LinkedIn posts: <strong>{week.posts}</strong>/7</div>
          <div>📖 Chapters read: <strong>{week.chapters}</strong>/7</div>
          <div>💪 Workout minutes: <strong>{week.workoutMinutes}</strong></div>
          <div>🤖 AI sessions: <strong>{week.aiSessions}</strong>/7</div>
          <div>
            💰 Saved: <strong>{week.saved}</strong>/{goals.weeklySavingsTarget} {goals.currency}
          </div>
          <div>🚀 Career actions: <strong>{week.careerActions}</strong>/7</div>
        </div>
      </Card>

      <Card title="Track streaks">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {TRACKS.map((t) => (
            <div key={t.key} className="rounded-xl border border-mist bg-pearl px-3 py-2 text-sm">
              {t.emoji} {t.label}:{" "}
              <strong className="text-groveDeep">{streaks.byTrack[t.key]}d</strong>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
