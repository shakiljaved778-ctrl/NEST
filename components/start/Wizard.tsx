"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  industries,
  goalOptions,
  styleDirections,
  packages,
  timelineOptions,
  qatarLocations,
  whatsappLink,
} from "@/data/content";
import { useLang } from "@/components/LanguageProvider";
import StyleTile from "./StyleTile";
import { emptyBrief, formatBrief, type BriefData } from "@/lib/brief";

const STORAGE_KEY = "qs.brief.draft";
const TOTAL = 5;

export default function Wizard() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<BriefData>(emptyBrief);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [restored, setRestored] = useState(false);

  // Restore draft from localStorage + apply ?package= preselect.
  useEffect(() => {
    let draft = emptyBrief;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) draft = { ...emptyBrief, ...JSON.parse(raw) };
    } catch {
      /* ignore malformed draft */
    }
    const pkg = searchParams.get("package");
    if (pkg && packages.some((p) => p.id === pkg)) draft = { ...draft, package: pkg };
    setData(draft);
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft on every change (after initial restore).
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage may be unavailable */
    }
  }, [data, restored]);

  const set = <K extends keyof BriefData>(key: K, value: BriefData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const toggleGoal = (id: string) =>
    setData((d) => ({
      ...d,
      goals: d.goals.includes(id)
        ? d.goals.filter((g) => g !== id)
        : [...d.goals, id],
    }));

  function validate(current: number): boolean {
    const e: Record<string, string> = {};
    if (current === 1) {
      if (!data.businessName.trim()) e.businessName = "Please add your business name.";
      if (!data.industry) e.industry = "Choose your industry.";
      if (!data.location) e.location = "Where in Qatar are you?";
      if (!data.hasWebsite) e.hasWebsite = "Let us know if you have a site.";
      if (data.hasWebsite === "yes" && !data.websiteUrl.trim())
        e.websiteUrl = "Add your current website URL.";
    }
    if (current === 2) {
      if (data.goals.length === 0 && !data.goalsOther.trim())
        e.goals = "Pick at least one goal.";
    }
    if (current === 3) {
      if (!data.style) e.style = "Select a style direction.";
    }
    if (current === 4) {
      if (!data.package) e.package = "Choose a package.";
      if (!data.timeline) e.timeline = "Pick a timeline.";
    }
    if (current === 5) {
      if (!data.name.trim()) e.name = "Your name, please.";
      if (!data.phone.trim() || data.phone.trim().length < 8)
        e.phone = "Add a phone we can reach you on.";
      if (!data.email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
        e.email = "A valid email, please.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validate(step)) return;
    setStep((s) => Math.min(TOTAL, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!validate(5)) return;
    setStatus("sending");
    const summary = formatBrief(data);
    try {
      await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, summary }),
      });
    } catch {
      /* Never block the confirmation on a network/API error — the client
         still gets their brief and a WhatsApp fallback. */
    }
    setStatus("done");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const briefText = useMemo(() => formatBrief(data), [data]);

  if (status === "done") {
    return <Confirmation briefText={briefText} onReset={() => location.reload()} />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-cream/60">
          <span>
            {t("wizard.step")} {step} {t("wizard.of")} {TOTAL}
          </span>
          {restored && <span className="text-cream/40">{t("wizard.saved")}</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gold transition-all duration-500"
            style={{ width: `${(step / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <div className="panel p-6 sm:p-8">
        {/* STEP 1 — Business */}
        {step === 1 && (
          <Step title={t("step1.title")}>
            <Field label={t("field.businessName")} error={errors.businessName}>
              <input
                className="qs-input"
                value={data.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                placeholder="e.g. Al Bahr Seafood"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("field.industry")} error={errors.industry}>
                <select
                  className="qs-input"
                  value={data.industry}
                  onChange={(e) => set("industry", e.target.value)}
                >
                  <option value="">Select…</option>
                  {industries.map((i) => (
                    <option key={i.id} value={i.id}>{i.label}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("field.location")} error={errors.location}>
                <select
                  className="qs-input"
                  value={data.location}
                  onChange={(e) => set("location", e.target.value)}
                >
                  <option value="">Select…</option>
                  {qatarLocations.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("field.hasWebsite")} error={errors.hasWebsite}>
              <div className="flex gap-3">
                {(["no", "yes"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("hasWebsite", v)}
                    className={`rounded-lg border px-5 py-2.5 text-sm font-medium transition ${
                      data.hasWebsite === v
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-white/15 text-cream/75 hover:border-gold/40"
                    }`}
                  >
                    {v === "yes" ? t("field.yes") : t("field.no")}
                  </button>
                ))}
              </div>
            </Field>
            {data.hasWebsite === "yes" && (
              <Field label={t("field.websiteUrl")} error={errors.websiteUrl}>
                <input
                  className="qs-input"
                  value={data.websiteUrl}
                  onChange={(e) => set("websiteUrl", e.target.value)}
                  placeholder="https://"
                />
              </Field>
            )}
          </Step>
        )}

        {/* STEP 2 — Goals */}
        {step === 2 && (
          <Step title={t("step2.title")}>
            <Field label={t("field.goals")} error={errors.goals}>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {goalOptions.map((g) => {
                  const on = data.goals.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGoal(g.id)}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                        on
                          ? "border-gold bg-gold/[0.08] text-cream"
                          : "border-white/12 text-cream/75 hover:border-gold/40"
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${
                          on ? "border-gold bg-gold text-navy-800" : "border-white/25 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t("field.goalsOther")}>
              <input
                className="qs-input"
                value={data.goalsOther}
                onChange={(e) => set("goalsOther", e.target.value)}
                placeholder="Tell us anything specific…"
              />
            </Field>
          </Step>
        )}

        {/* STEP 3 — Style */}
        {step === 3 && (
          <Step title={t("step3.title")}>
            {errors.style && <p className="qs-error">{errors.style}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {styleDirections.map((s) => (
                <StyleTile
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  desc={s.desc}
                  selected={data.style === s.id}
                  onSelect={() => set("style", s.id)}
                />
              ))}
            </div>
          </Step>
        )}

        {/* STEP 4 — Package + timeline */}
        {step === 4 && (
          <Step title={t("step4.title")}>
            {errors.package && <p className="qs-error">{errors.package}</p>}
            <div className="grid gap-3">
              {packages.map((p) => {
                const on = data.package === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set("package", p.id)}
                    className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left transition ${
                      on ? "border-gold bg-gold/[0.08]" : "border-white/12 hover:border-gold/40"
                    }`}
                  >
                    <span>
                      <span className="font-display text-lg">{p.name}</span>
                      <span className="block text-xs text-cream/60">{p.delivery}</span>
                    </span>
                    <span className="font-display text-xl text-gold">{p.priceQAR}</span>
                  </button>
                );
              })}
            </div>
            <Field label={t("field.timeline")} error={errors.timeline}>
              <div className="flex flex-wrap gap-2.5">
                {timelineOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => set("timeline", o.id)}
                    className={`rounded-lg border px-4 py-2.5 text-sm transition ${
                      data.timeline === o.id
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-white/15 text-cream/75 hover:border-gold/40"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
          </Step>
        )}

        {/* STEP 5 — Contact */}
        {step === 5 && (
          <Step title={t("step5.title")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("field.name")} error={errors.name}>
                <input className="qs-input" value={data.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label={t("field.role")}>
                <input className="qs-input" value={data.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Owner" />
              </Field>
              <Field label={t("field.phone")} error={errors.phone}>
                <input className="qs-input" value={data.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
              </Field>
              <Field label={t("field.email")} error={errors.email}>
                <input className="qs-input" value={data.email} onChange={(e) => set("email", e.target.value)} inputMode="email" placeholder="name@company.qa" />
              </Field>
            </div>
            <Field label={t("field.contactMethod")}>
              <div className="flex flex-wrap gap-2.5">
                {[
                  { id: "whatsapp", label: t("method.whatsapp") },
                  { id: "phone", label: t("method.phone") },
                  { id: "email", label: t("method.email") },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set("contactMethod", m.id)}
                    className={`rounded-lg border px-4 py-2.5 text-sm transition ${
                      data.contactMethod === m.id
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-white/15 text-cream/75 hover:border-gold/40"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Live brief preview */}
            <details className="mt-2 rounded-lg border border-white/10 bg-black/20 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gold">
                Preview your brief
              </summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-cream/70">{briefText}</pre>
            </details>
          </Step>
        )}

        {/* Nav */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button onClick={back} className="btn-ghost">← {t("cta.back")}</button>
          ) : (
            <span />
          )}
          {step < TOTAL ? (
            <button onClick={next} className="btn-gold">{t("cta.next")} →</button>
          ) : (
            <button onClick={submit} disabled={status === "sending"} className="btn-gold">
              {status === "sending" ? "Sending…" : t("cta.submit")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="animate-fadeUp">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-cream/85">{label}</span>
      {children}
      {error && <span className="qs-error">{error}</span>}
    </label>
  );
}

function Confirmation({
  briefText,
  onReset,
}: {
  briefText: string;
  onReset: () => void;
}) {
  const { t } = useLang();
  const nextSteps = [t("brief.next1"), t("brief.next2"), t("brief.next3")];
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-gold/40 bg-gold/10 text-3xl text-gold">
        ✓
      </div>
      <h1 className="mt-6 font-display text-3xl sm:text-4xl">{t("brief.confirmTitle")}</h1>
      <p className="mt-3 text-gold">{t("brief.confirmSub")}</p>

      <div className="panel mt-8 p-6 text-left">
        <h2 className="font-display text-lg">{t("brief.title")}</h2>
        <pre className="mt-4 whitespace-pre-wrap text-xs text-cream/75">{briefText}</pre>
      </div>

      <div className="panel mt-6 p-6 text-left">
        <h3 className="font-display text-lg">{t("brief.next")}</h3>
        <ol className="mt-4 space-y-3">
          {nextSteps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-cream/80">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-gold/40 text-xs text-gold">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-6 text-sm text-cream/60">{t("brief.whatsappNudge")}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <a
          href={whatsappLink(briefText)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold"
        >
          {t("cta.whatsapp")}
        </a>
        <button onClick={onReset} className="btn-ghost">{t("cta.startOver")}</button>
        <Link href="/work" className="btn-ghost">{t("cta.backToWork")}</Link>
      </div>
    </div>
  );
}
