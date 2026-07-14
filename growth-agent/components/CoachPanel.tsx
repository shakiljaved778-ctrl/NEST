"use client";

import { useState } from "react";
import { getCoach } from "@/lib/coach";
import { Digest } from "@/lib/emailDigest";
import { DailyCheckin, Goals, TRACKS } from "@/lib/types";
import { Card } from "./ui";

export default function CoachPanel({
  goals,
  history,
  today,
}: {
  goals: Goals;
  history: DailyCheckin[];
  today: string;
}) {
  const briefing = getCoach().dailyBriefing({ goals, history, today });
  const [emailState, setEmailState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "done"; sent: boolean; to: string; reason?: string; digest?: Digest }
  >({ kind: "idle" });

  const sendDigest = async () => {
    setEmailState({ kind: "sending" });
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals, history }),
      });
      const data = (await res.json()) as {
        sent: boolean;
        to: string;
        reason?: string;
        digest?: Digest;
      };
      setEmailState({ kind: "done", ...data });
    } catch {
      setEmailState({
        kind: "done",
        sent: false,
        to: goals.email,
        reason: "Could not reach the digest API",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-xs font-medium uppercase tracking-widest text-gold">
          Daily briefing · {today}
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink">{briefing.headline}</h2>
        <p className="mt-2 italic text-inkSoft">“{briefing.motivation}”</p>
      </Card>

      <Card title="Today's plan — six tracks">
        <ul className="space-y-2">
          {briefing.trackAdvice.map((a) => {
            const meta = TRACKS.find((t) => t.key === a.track)!;
            return (
              <li key={a.track} className="rounded-xl border border-mist bg-pearl px-4 py-3 text-sm">
                <span className="font-semibold text-ink">
                  {meta.emoji} {meta.label}:
                </span>{" "}
                <span className="text-inkSoft">{a.message}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="💼 LinkedIn idea of the day">
          <p className="text-sm text-inkSoft">{briefing.linkedinIdea}</p>
        </Card>
        <Card title="📖 Today's chapter">
          <p className="text-sm font-semibold text-ink">{briefing.chapterSuggestion.chapter}</p>
          <p className="text-xs text-inkSoft">{briefing.chapterSuggestion.book}</p>
          <p className="mt-2 text-sm text-inkSoft">💡 {briefing.chapterSuggestion.why}</p>
        </Card>
        <Card title="🤖 AI lesson of the day">
          <p className="text-sm font-semibold text-ink">{briefing.aiLesson.topic}</p>
          <p className="mt-1 text-sm text-inkSoft">{briefing.aiLesson.task}</p>
        </Card>
        <Card title="💰 Finance tip">
          <p className="text-sm text-inkSoft">{briefing.financeTip}</p>
        </Card>
      </div>

      <Card title="Email updates">
        <p className="text-sm text-inkSoft">
          Send this briefing (plus your scoreboard) to <strong>{goals.email}</strong>. Set up the
          SMTP variables once (see README) and a daily cron can deliver it automatically every
          morning.
        </p>
        <button
          type="button"
          onClick={sendDigest}
          disabled={emailState.kind === "sending"}
          className="mt-3 rounded-xl bg-grove px-5 py-2.5 text-sm font-semibold text-white hover:bg-groveDeep disabled:opacity-50"
        >
          {emailState.kind === "sending" ? "Sending…" : "Email me today's digest"}
        </button>
        {emailState.kind === "done" && (
          <div className="mt-3 text-sm">
            {emailState.sent ? (
              <p className="font-medium text-groveDeep">✓ Sent to {emailState.to}</p>
            ) : (
              <div className="rounded-xl border border-mist bg-pearl p-3">
                <p className="font-medium text-blush">
                  Not sent: {emailState.reason ?? "unknown error"}
                </p>
                {emailState.digest && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-inkSoft">
                      Preview the email that would be sent
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-inkSoft">
                      {emailState.digest.subject + "\n\n" + emailState.digest.text}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
