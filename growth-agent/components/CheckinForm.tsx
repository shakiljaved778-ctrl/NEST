"use client";

import { useState } from "react";
import { getCoach } from "@/lib/coach";
import { DailyCheckin, Goals, PostFeedback } from "@/lib/types";
import { Card, Field, Toggle, inputCls } from "./ui";

export default function CheckinForm({
  goals,
  initial,
  onSave,
}: {
  goals: Goals;
  initial: DailyCheckin;
  onSave: (c: DailyCheckin) => void;
}) {
  const [form, setForm] = useState<DailyCheckin>(initial);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<PostFeedback | null>(null);

  const set = <K extends keyof DailyCheckin>(key: K, value: DailyCheckin[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const num = (v: string) => (v === "" ? 0 : Math.max(Number(v) || 0, 0));

  return (
    <div className="space-y-4">
      <Card title={`Daily check-in — ${form.date}`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Toggle
              label="🚀 One deliberate career action today"
              checked={form.careerAction}
              onChange={(v) => set("careerAction", v)}
            />
            {form.careerAction && (
              <Field label="What was it?">
                <input
                  className={inputCls}
                  value={form.careerNote}
                  onChange={(e) => set("careerNote", e.target.value)}
                  placeholder="e.g. emailed 3 investors, refined pitch metrics"
                />
              </Field>
            )}

            <Toggle
              label="💼 Posted on LinkedIn today"
              checked={form.linkedinPosted}
              onChange={(v) => set("linkedinPosted", v)}
            />
            <Field label={`Meaningful engagements (target ${goals.linkedinEngagementsPerDay})`}>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.linkedinEngagements || ""}
                onChange={(e) => set("linkedinEngagements", num(e.target.value))}
                placeholder="comments / replies you made"
              />
            </Field>

            <Toggle
              label={`📖 Read a chapter of “${goals.currentBook}”`}
              checked={form.chapterRead}
              onChange={(v) => set("chapterRead", v)}
            />
            {form.chapterRead && (
              <Field label="One takeaway">
                <input
                  className={inputCls}
                  value={form.chapterNote}
                  onChange={(e) => set("chapterNote", e.target.value)}
                  placeholder="the idea you'll actually use"
                />
              </Field>
            )}
          </div>

          <div className="space-y-3">
            <Field label={`Workout minutes (target ${goals.workoutMinutesPerDay})`}>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.workoutMinutes || ""}
                onChange={(e) => set("workoutMinutes", num(e.target.value))}
              />
            </Field>
            <Field label="Weight today (kg, optional)">
              <input
                type="number"
                min={0}
                step="0.1"
                className={inputCls}
                value={form.weightKg ?? ""}
                onChange={(e) =>
                  set("weightKg", e.target.value === "" ? null : Math.max(Number(e.target.value) || 0, 0))
                }
              />
            </Field>

            <Toggle
              label="🤖 AI learning session done"
              checked={form.aiLearningDone}
              onChange={(v) => set("aiLearningDone", v)}
            />
            {form.aiLearningDone && (
              <Field label="Topic">
                <input
                  className={inputCls}
                  value={form.aiTopic}
                  onChange={(e) => set("aiTopic", e.target.value)}
                  placeholder="e.g. prompt engineering, RAG"
                />
              </Field>
            )}

            <Field
              label={`Saved / invested today (${goals.currency}, weekly target ${goals.weeklySavingsTarget})`}
            >
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.savedAmount || ""}
                onChange={(e) => set("savedAmount", num(e.target.value))}
              />
            </Field>

            <Field label="Notes (optional)">
              <input
                className={inputCls}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="anything else about today"
              />
            </Field>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onSave(form);
            setSaved(true);
          }}
          className="mt-4 w-full rounded-xl bg-grove px-4 py-3 text-sm font-semibold text-white hover:bg-groveDeep md:w-auto md:px-8"
        >
          {saved ? "✓ Saved" : "Save today's check-in"}
        </button>
      </Card>

      <Card title="LinkedIn post review (optional)">
        <p className="mb-2 text-sm text-inkSoft">
          Paste today&apos;s post and the coach will score its hook, structure, and call to action.
        </p>
        <textarea
          className={`${inputCls} min-h-[120px]`}
          value={form.linkedinPostText}
          onChange={(e) => set("linkedinPostText", e.target.value)}
          placeholder="Paste your LinkedIn post here…"
        />
        <button
          type="button"
          onClick={() => setFeedback(getCoach().reviewLinkedinPost(form.linkedinPostText))}
          disabled={!form.linkedinPostText.trim()}
          className="mt-3 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Review my post
        </button>
        {feedback && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="font-display text-xl font-bold text-ink">
              Post score: {feedback.score}/100
            </div>
            {feedback.strengths.length > 0 && (
              <div>
                <div className="font-semibold text-groveDeep">Working well</div>
                <ul className="list-disc pl-5 text-ink">
                  {feedback.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {feedback.improvements.length > 0 && (
              <div>
                <div className="font-semibold text-blush">Make it stronger</div>
                <ul className="list-disc pl-5 text-ink">
                  {feedback.improvements.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
