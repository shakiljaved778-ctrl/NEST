"use client";

import { useState } from "react";
import { BOOKS } from "@/lib/books";
import { Goals } from "@/lib/types";
import { Card, Field, inputCls } from "./ui";

export default function GoalsForm({
  goals,
  onSave,
}: {
  goals: Goals;
  onSave: (g: Goals) => void;
}) {
  const [form, setForm] = useState<Goals>(goals);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Goals>(key: K, value: Goals[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const numOrNull = (v: string) => (v === "" ? null : Math.max(Number(v) || 0, 0));
  const num = (v: string, fallback = 0) => (v === "" ? fallback : Math.max(Number(v) || 0, 0));

  return (
    <div className="space-y-4">
      <Card title="You">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Your name">
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Email for daily updates">
            <input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="🚀 Career focus (founder track)">
        <p className="mb-2 text-xs text-inkSoft">One per line — the coach rotates through these.</p>
        <textarea
          className={`${inputCls} min-h-[110px]`}
          value={form.careerFocus.join("\n")}
          onChange={(e) =>
            set(
              "careerFocus",
              e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
            )
          }
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="💼 LinkedIn & 📖 Reading">
          <div className="space-y-3">
            <Field label="Posts per day">
              <input type="number" min={0} className={inputCls} value={form.linkedinPostsPerDay}
                onChange={(e) => set("linkedinPostsPerDay", num(e.target.value, 1))} />
            </Field>
            <Field label="Meaningful engagements per day">
              <input type="number" min={0} className={inputCls} value={form.linkedinEngagementsPerDay}
                onChange={(e) => set("linkedinEngagementsPerDay", num(e.target.value, 3))} />
            </Field>
            <Field label="Current book">
              <select
                className={inputCls}
                value={BOOKS.some((b) => b.title === form.currentBook) ? form.currentBook : "__custom"}
                onChange={(e) => {
                  if (e.target.value !== "__custom") set("currentBook", e.target.value);
                }}
              >
                {BOOKS.map((b) => (
                  <option key={b.title} value={b.title}>
                    {b.title} — {b.author}
                  </option>
                ))}
                <option value="__custom">Custom (type below)</option>
              </select>
            </Field>
            <Field label="Or type any book title">
              <input className={inputCls} value={form.currentBook}
                onChange={(e) => set("currentBook", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="💪 Fitness & weight loss">
          <div className="space-y-3">
            <Field label="Workout minutes per day">
              <input type="number" min={0} className={inputCls} value={form.workoutMinutesPerDay}
                onChange={(e) => set("workoutMinutesPerDay", num(e.target.value, 30))} />
            </Field>
            <Field label="Current weight (kg)">
              <input type="number" min={0} step="0.1" className={inputCls} value={form.currentWeightKg ?? ""}
                onChange={(e) => set("currentWeightKg", numOrNull(e.target.value))} />
            </Field>
            <Field label="Target weight (kg)">
              <input type="number" min={0} step="0.1" className={inputCls} value={form.targetWeightKg ?? ""}
                onChange={(e) => set("targetWeightKg", numOrNull(e.target.value))} />
            </Field>
            <Field label="Weight-loss pace (kg per week)">
              <input type="number" min={0} step="0.1" className={inputCls} value={form.weeklyWeightLossKg}
                onChange={(e) => set("weeklyWeightLossKg", num(e.target.value, 0.5))} />
            </Field>
          </div>
        </Card>

        <Card title="🤖 AI learning">
          <Field label="Sessions per day">
            <input type="number" min={0} className={inputCls} value={form.aiSessionsPerDay}
              onChange={(e) => set("aiSessionsPerDay", num(e.target.value, 1))} />
          </Field>
        </Card>

        <Card title="💰 Finance building">
          <div className="space-y-3">
            <Field label="Currency">
              <input className={inputCls} value={form.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())} />
            </Field>
            <Field label={`Weekly savings target (${form.currency})`}>
              <input type="number" min={0} className={inputCls} value={form.weeklySavingsTarget}
                onChange={(e) => set("weeklySavingsTarget", num(e.target.value, 500))} />
            </Field>
          </div>
        </Card>
      </div>

      <button
        type="button"
        onClick={() => {
          onSave(form);
          setSaved(true);
        }}
        className="w-full rounded-xl bg-grove px-4 py-3 text-sm font-semibold text-white hover:bg-groveDeep md:w-auto md:px-8"
      >
        {saved ? "✓ Goals saved" : "Save goals"}
      </button>
    </div>
  );
}
