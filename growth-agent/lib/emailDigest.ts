import { getCoach } from "./coach";
import { computeStreaks, scoreDay, weekSummary, weightTrend } from "./scoring";
import { DailyCheckin, Goals, TRACKS } from "./types";

export interface Digest {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Render the daily briefing + scoreboard as an email. Pure function —
 * the same content backs the SMTP send, the in-app preview, and tests.
 */
export function buildDigest(goals: Goals, history: DailyCheckin[], today: string): Digest {
  const coach = getCoach();
  const briefing = coach.dailyBriefing({ goals, history, today });
  const streaks = computeStreaks(history, goals, today);
  const week = weekSummary(history, goals, today);
  const weight = weightTrend(history, today);
  const todayCheckin = history.find((c) => c.date === today);
  const todayScore = todayCheckin ? scoreDay(todayCheckin, goals).total : null;

  const subject = `🌱 Growth Agent — ${today}: ${briefing.headline}`;

  const statLines = [
    `Today's score: ${todayScore != null ? `${todayScore}/100` : "not logged yet"}`,
    `Streak: ${streaks.overall} day(s) · 7-day average: ${week.avgScore}/100 (${week.daysLogged}/7 logged)`,
    `Weight: ${weight.current != null ? `${weight.current} kg` : "no weigh-in"}` +
      (weight.weekChange != null
        ? ` (${weight.weekChange > 0 ? "+" : ""}${weight.weekChange} kg this week)`
        : ""),
    `This week: ${week.posts} posts · ${week.chapters} chapters · ${week.workoutMinutes} workout min · ${week.aiSessions} AI sessions · ${week.saved}/${goals.weeklySavingsTarget} ${goals.currency} saved · ${week.careerActions} career actions`,
  ];

  const adviceLines = briefing.trackAdvice.map((a) => {
    const meta = TRACKS.find((t) => t.key === a.track)!;
    return `${meta.emoji} ${meta.label}: ${a.message}`;
  });

  const text = [
    briefing.headline,
    "",
    `“${briefing.motivation}”`,
    "",
    "— SCOREBOARD —",
    ...statLines,
    "",
    "— TODAY'S PLAN —",
    ...adviceLines,
    "",
    `💼 LinkedIn idea: ${briefing.linkedinIdea}`,
    `📖 Chapter: ${briefing.chapterSuggestion.chapter} (${briefing.chapterSuggestion.book}) — ${briefing.chapterSuggestion.why}`,
    `🤖 AI lesson — ${briefing.aiLesson.topic}: ${briefing.aiLesson.task}`,
    `💰 Finance tip: ${briefing.financeTip}`,
    "",
    "Log today's check-in in your Growth Agent app.",
  ].join("\n");

  const html = `
  <div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;color:#101B2E">
    <div style="background:#101B2E;color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
      <div style="font-size:12px;letter-spacing:2px;color:#C9A227">PERSONAL GROWTH AGENT · ${esc(today)}</div>
      <h1 style="margin:8px 0 0;font-size:22px">${esc(briefing.headline)}</h1>
    </div>
    <div style="border:1px solid #E4EAF2;border-top:0;padding:20px 24px;border-radius:0 0 14px 14px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6">
      <p style="font-style:italic;color:#26364F">“${esc(briefing.motivation)}”</p>
      <h2 style="font-size:15px;margin:18px 0 6px">Scoreboard</h2>
      <ul style="margin:0;padding-left:18px">${statLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      <h2 style="font-size:15px;margin:18px 0 6px">Today's plan</h2>
      <ul style="margin:0;padding-left:18px">${adviceLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      <h2 style="font-size:15px;margin:18px 0 6px">Fuel for today</h2>
      <ul style="margin:0;padding-left:18px">
        <li>💼 <strong>LinkedIn idea:</strong> ${esc(briefing.linkedinIdea)}</li>
        <li>📖 <strong>Chapter:</strong> ${esc(briefing.chapterSuggestion.chapter)} — <em>${esc(briefing.chapterSuggestion.book)}</em>. ${esc(briefing.chapterSuggestion.why)}</li>
        <li>🤖 <strong>AI lesson (${esc(briefing.aiLesson.topic)}):</strong> ${esc(briefing.aiLesson.task)}</li>
        <li>💰 <strong>Finance tip:</strong> ${esc(briefing.financeTip)}</li>
      </ul>
      <p style="margin-top:18px;color:#26364F">Log today's check-in in your Growth Agent app to keep the streak alive.</p>
    </div>
  </div>`;

  return { subject, text, html };
}
