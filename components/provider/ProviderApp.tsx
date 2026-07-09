"use client";

import { useState } from "react";
import Link from "next/link";
import PhoneFrame from "@/components/PhoneFrame";
import { getService } from "@/lib/catalog";

type Screen =
  | "onboarding"
  | "kyc"
  | "skills"
  | "availability"
  | "jobs"
  | "job-detail"
  | "route"
  | "checklist"
  | "photos"
  | "complete"
  | "earnings"
  | "ratings"
  | "training";

const SCREEN_MAP: { group: string; screens: { id: Screen; label: string }[] }[] = [
  {
    group: "Onboarding",
    screens: [
      { id: "onboarding", label: "Sign up" },
      { id: "kyc", label: "KYC documents" },
      { id: "skills", label: "Skills & tests" },
      { id: "availability", label: "Availability" },
    ],
  },
  {
    group: "Working a job",
    screens: [
      { id: "jobs", label: "Job requests" },
      { id: "job-detail", label: "Job details" },
      { id: "route", label: "Navigation" },
      { id: "checklist", label: "Service checklist" },
      { id: "photos", label: "Before / after photos" },
      { id: "complete", label: "Job completion" },
    ],
  },
  {
    group: "Growth",
    screens: [
      { id: "earnings", label: "Earnings" },
      { id: "ratings", label: "Ratings & quality" },
      { id: "training", label: "Training academy" },
    ],
  },
];

const JOB = {
  id: "NB-1041",
  serviceId: "ac-technician",
  packageName: "AC service (2 units)",
  customer: "Sara A.",
  zone: "West Bay",
  address: "Marina Tower 12, Apt 804",
  slot: "Today · 10:00",
  payout: 158,
  distanceKm: 3.2,
};

const CHECKLIST = [
  "Confirm unit count & type with customer",
  "Protect flooring with drop sheet",
  "Clean filters & indoor coils",
  "Check gas pressure & compressor amps",
  "Flush drain line, test for leakage",
  "Run 15-min cooling performance test",
  "Show before/after photos to customer",
];

export default function ProviderApp() {
  const [screen, setScreen] = useState<Screen>("jobs");
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [jobAccepted, setJobAccepted] = useState(false);
  const [photosTaken, setPhotosTaken] = useState<{ before: boolean; after: boolean }>({ before: false, after: false });
  const [online, setOnline] = useState(true);

  const service = getService(JOB.serviceId);
  const checklistDone = checked.filter(Boolean).length;

  function Header({ title, back }: { title: string; back?: Screen }) {
    return (
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-navy-100">
        {back && (
          <button onClick={() => setScreen(back)} className="h-8 w-8 rounded-full bg-pearl text-navy flex items-center justify-center font-bold">
            ←
          </button>
        )}
        <h2 className="font-display font-bold text-navy text-lg flex-1">{title}</h2>
        <button
          onClick={() => setOnline(!online)}
          className={`chip ${online ? "bg-teal-soft text-teal-dark" : "bg-navy-50 text-navy-400"}`}
        >
          {online ? "● Online" : "○ Offline"}
        </button>
      </div>
    );
  }

  function BottomNav() {
    const items: { id: Screen; icon: string; label: string }[] = [
      { id: "jobs", icon: "🧰", label: "Jobs" },
      { id: "earnings", icon: "💰", label: "Earnings" },
      { id: "ratings", icon: "⭐", label: "Quality" },
      { id: "training", icon: "🎓", label: "Academy" },
    ];
    return (
      <nav className="grid grid-cols-4 border-t border-navy-100 bg-white">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => setScreen(it.id)}
            className={`py-2.5 text-center text-[11px] font-semibold ${screen === it.id ? "text-teal" : "text-navy-300"}`}
          >
            <span className="block text-lg leading-none">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>
    );
  }

  function renderScreen() {
    switch (screen) {
      case "onboarding":
        return (
          <div className="flex-1 flex flex-col px-6 pt-10 pb-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-gold text-xl mb-6">⌂</span>
            <h2 className="font-display text-2xl font-bold text-navy">Earn with Nest</h2>
            <p className="text-sm text-navy-400 mt-1 mb-6">
              Steady jobs, fair pay, weekly payouts. Join Qatar's trusted provider network.
            </p>
            <div className="space-y-3">
              {[
                { step: "1", label: "Phone OTP sign-up", done: true },
                { step: "2", label: "QID / passport & work permit", done: false },
                { step: "3", label: "Skills, tests & training", done: false },
                { step: "4", label: "Bank details & go live", done: false },
              ].map((s) => (
                <div key={s.step} className="card p-4 flex items-center gap-3">
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${s.done ? "bg-teal text-white" : "bg-navy-50 text-navy-400"}`}>
                    {s.done ? "✓" : s.step}
                  </span>
                  <span className="text-sm font-semibold text-navy">{s.label}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setScreen("kyc")} className="btn-primary mt-auto">Continue</button>
          </div>
        );

      case "kyc":
        return (
          <>
            <Header title="KYC documents" back="onboarding" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              {[
                { doc: "Qatar ID (front & back)", status: "Verified", tone: "bg-teal-soft text-teal-dark" },
                { doc: "Work permit", status: "Verified", tone: "bg-teal-soft text-teal-dark" },
                { doc: "Police clearance", status: "In review", tone: "bg-gold-soft text-gold-dark" },
                { doc: "Trade certification (AC)", status: "Upload", tone: "bg-navy-50 text-navy-400" },
              ].map((d) => (
                <div key={d.doc} className="card p-4 flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-navy-50 flex items-center justify-center text-lg">📄</span>
                  <span className="flex-1 text-sm font-bold text-navy">{d.doc}</span>
                  <span className={`chip ${d.tone}`}>{d.status}</span>
                </div>
              ))}
              <p className="text-xs text-navy-400 pt-2">
                🔒 Documents are encrypted (KMS) and visible only to the verification team — never to customers.
              </p>
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("skills")} className="btn-primary w-full">Continue</button>
            </div>
          </>
        );

      case "skills":
        return (
          <>
            <Header title="Skills & tests" back="kyc" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              {[
                { skill: "AC technician", level: "Expert · 8 yrs", test: "Passed 92%" },
                { skill: "Appliance repair", level: "Advanced · 5 yrs", test: "Passed 87%" },
                { skill: "Electrical", level: "Intermediate · 3 yrs", test: "Test pending" },
              ].map((s) => (
                <div key={s.skill} className="card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-navy">{s.skill}</p>
                    <span className={`chip ${s.test.startsWith("Passed") ? "bg-teal-soft text-teal-dark" : "bg-gold-soft text-gold-dark"}`}>{s.test}</span>
                  </div>
                  <p className="text-xs text-navy-400 mt-1">{s.level}</p>
                </div>
              ))}
              <button className="btn-ghost w-full">+ Add another skill</button>
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("availability")} className="btn-primary w-full">Continue</button>
            </div>
          </>
        );

      case "availability":
        return (
          <>
            <Header title="Availability" back="skills" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
              <div className="card p-4">
                <p className="text-xs font-semibold text-navy-400 mb-2">Working days</p>
                <div className="flex gap-1.5">
                  {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
                    <span key={d} className={`flex-1 rounded-lg py-2 text-center text-xs font-bold ${i < 6 ? "bg-navy text-white" : "bg-navy-50 text-navy-300"}`}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold text-navy-400 mb-2">Hours</p>
                <p className="text-sm font-bold text-navy">08:00 — 20:00 <span className="chip bg-gold-soft text-gold-dark ms-2">Peak hours on</span></p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold text-navy-400 mb-2">Service zones</p>
                <div className="flex flex-wrap gap-2">
                  {["West Bay", "Al Sadd", "Msheireb"].map((z) => (
                    <span key={z} className="chip bg-teal-soft text-teal-dark">📍 {z}</span>
                  ))}
                  <span className="chip bg-navy-50 text-navy-400">+ Add zone</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("jobs")} className="btn-gold w-full">Go live 🎉</button>
            </div>
          </>
        );

      case "jobs":
        return (
          <>
            <Header title="Job requests" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              <div className="card !border-teal ring-2 ring-teal/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="chip bg-teal text-white">New request · expires 04:32</span>
                  <span className="font-bold text-navy">QAR {JOB.payout}</span>
                </div>
                <p className="font-bold text-navy text-sm">{service?.icon} {JOB.packageName}</p>
                <p className="text-xs text-navy-400 mt-1">{JOB.slot} · {JOB.zone} · {JOB.distanceKm} km away</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => { setJobAccepted(true); setScreen("job-detail"); }}
                    className="btn-primary !py-2.5 !bg-teal hover:!bg-teal-dark"
                  >
                    Accept
                  </button>
                  <button className="btn-ghost !py-2.5">Decline</button>
                </div>
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-navy-300 pt-2">Today</p>
              {[
                { name: "Deep AC clean — The Pearl", time: "14:00", pay: 149 },
                { name: "Washing machine diagnosis — Al Sadd", time: "17:30", pay: 59 },
              ].map((j) => (
                <div key={j.name} className="card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-navy">{j.name}</p>
                    <p className="text-xs text-navy-400">{j.time} · scheduled</p>
                  </div>
                  <span className="font-bold text-navy text-sm">QAR {j.pay}</span>
                </div>
              ))}
              <p className="text-xs text-navy-400 pt-1">
                📶 Offline-first: jobs, checklists and photos are cached and sync when you're back online.
              </p>
            </div>
            <BottomNav />
          </>
        );

      case "job-detail":
        return (
          <>
            <Header title={`Job ${JOB.id}`} back="jobs" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              {jobAccepted && <p className="rounded-xl bg-teal-soft text-teal-dark text-xs font-semibold px-4 py-3">✓ Job accepted — customer notified</p>}
              <div className="card p-4 space-y-2 text-sm">
                <p className="font-bold text-navy">{service?.icon} {JOB.packageName}</p>
                <p className="text-navy-500">👤 {JOB.customer} · <span className="chip bg-teal-soft text-teal-dark">★ 4.9 customer</span></p>
                <p className="text-navy-500">📍 {JOB.address}, {JOB.zone}</p>
                <p className="text-navy-500">🕙 {JOB.slot}</p>
                <p className="text-navy-500">💰 Your payout: <b className="text-navy">QAR {JOB.payout}</b> (after 20% commission)</p>
              </div>
              <div className="card p-4 text-sm">
                <p className="font-bold text-navy mb-1">Customer notes</p>
                <p className="text-navy-500 text-xs">"Two split units in bedrooms. One drips water. Please bring a ladder."</p>
                <p className="text-[11px] text-teal-dark mt-2">✦ AI translated from Arabic</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setScreen("route")} className="btn-primary !py-2.5">Navigate 🧭</button>
                <button onClick={() => setScreen("checklist")} className="btn-ghost !py-2.5">Checklist</button>
              </div>
            </div>
            <BottomNav />
          </>
        );

      case "route":
        return (
          <>
            <Header title="Navigation" back="job-detail" />
            <div className="flex-1 flex flex-col">
              <div className="relative flex-1 bg-teal-soft overflow-hidden">
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 26px, #12294B18 27px), repeating-linear-gradient(90deg, transparent, transparent 26px, #12294B18 27px)" }} />
                <svg viewBox="0 0 375 400" className="absolute inset-0 h-full w-full">
                  <path d="M60 350 C 140 300, 130 180, 300 80" fill="none" stroke="#12294B" strokeWidth="5" strokeLinecap="round" />
                </svg>
                <span className="absolute bottom-[40px] left-[48px] h-5 w-5 rounded-full bg-teal border-4 border-white pulse-dot" />
                <span className="absolute top-[64px] right-[60px] text-2xl">🏠</span>
                <div className="absolute top-3 inset-x-3 card p-3 text-sm font-semibold text-navy">
                  → Head north on Corniche St, exit at Marina District
                </div>
              </div>
              <div className="p-4 bg-white border-t border-navy-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-navy">{JOB.distanceKm} km · 9 min</p>
                  <p className="text-xs text-navy-400">Customer sees your live location</p>
                </div>
                <button onClick={() => setScreen("checklist")} className="btn-gold !py-2.5">I've arrived</button>
              </div>
            </div>
          </>
        );

      case "checklist":
        return (
          <>
            <Header title="Service checklist" back="job-detail" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-2">
              <p className="text-xs text-navy-400 mb-1">
                {checklistDone}/{CHECKLIST.length} completed — required to close the job
              </p>
              <div className="h-1.5 rounded bg-navy-100 overflow-hidden mb-3">
                <span className="block h-full bg-teal transition-all" style={{ width: `${(checklistDone / CHECKLIST.length) * 100}%` }} />
              </div>
              {CHECKLIST.map((item, i) => (
                <button
                  key={item}
                  onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                  className={`card w-full p-3.5 flex items-center gap-3 text-start ${checked[i] ? "!border-teal" : ""}`}
                >
                  <span className={`h-6 w-6 shrink-0 rounded-md border-2 flex items-center justify-center text-xs font-bold ${checked[i] ? "bg-teal border-teal text-white" : "border-navy-200 text-transparent"}`}>
                    ✓
                  </span>
                  <span className={`text-sm ${checked[i] ? "text-navy-300 line-through" : "text-navy font-semibold"}`}>{item}</span>
                </button>
              ))}
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("photos")} className="btn-primary w-full" disabled={checklistDone < CHECKLIST.length - 2}>
                Continue to photos
              </button>
            </div>
          </>
        );

      case "photos":
        return (
          <>
            <Header title="Before / after photos" back="checklist" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
              <p className="text-xs text-navy-400">
                Proof photos protect you in disputes and feed the AI quality score.
              </p>
              {(["before", "after"] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setPhotosTaken((p) => ({ ...p, [kind]: true }))}
                  className={`card w-full h-36 flex flex-col items-center justify-center gap-2 ${photosTaken[kind] ? "!border-teal ring-2 ring-teal/20" : "border-dashed"}`}
                >
                  {photosTaken[kind] ? (
                    <>
                      <span className="text-3xl">🖼️</span>
                      <span className="text-sm font-bold text-teal-dark">✓ {kind === "before" ? "Before" : "After"} photo uploaded</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">📷</span>
                      <span className="text-sm font-bold text-navy capitalize">Take {kind} photo</span>
                      <span className="text-xs text-navy-400">Uploads retry automatically on poor signal</span>
                    </>
                  )}
                </button>
              ))}
            </div>
            <div className="p-4 bg-white border-t border-navy-100">
              <button onClick={() => setScreen("complete")} className="btn-primary w-full" disabled={!photosTaken.before || !photosTaken.after}>
                Complete job
              </button>
            </div>
          </>
        );

      case "complete":
        return (
          <div className="flex-1 flex flex-col px-6 pt-14 pb-6">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white text-3xl">✓</span>
            <h2 className="font-display text-2xl font-bold text-navy text-center mt-4">Job completed!</h2>
            <p className="text-center text-sm text-navy-400 mt-2">Customer confirmed · payment captured</p>
            <div className="card p-4 mt-6 space-y-2 text-sm">
              <div className="flex justify-between text-navy-500"><span>Service total</span><span>QAR 198</span></div>
              <div className="flex justify-between text-navy-500"><span>Nest commission (20%)</span><span>−QAR 40</span></div>
              <div className="flex justify-between border-t border-navy-100 pt-2 font-bold text-navy"><span>Your earning</span><span>QAR {JOB.payout}</span></div>
              <p className="text-xs text-navy-400">Paid out with Thursday's weekly settlement</p>
            </div>
            <div className="card p-4 mt-3 text-xs text-navy-500">
              ✦ AI quality score for this job: <b className="text-teal-dark">96/100</b> — checklist complete, photos clear, on-time arrival.
            </div>
            <button onClick={() => setScreen("earnings")} className="btn-gold mt-auto">View earnings</button>
          </div>
        );

      case "earnings":
        return (
          <>
            <Header title="Earnings" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
              <div className="rounded-2xl bg-navy-800 text-white p-5">
                <p className="text-xs text-navy-200">This week</p>
                <p className="font-display text-3xl font-bold mt-1">QAR 1,842</p>
                <p className="text-xs text-navy-200 mt-2">23 jobs · 96% completion · next payout Thu</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold text-navy-400 mb-3">Daily earnings</p>
                <div className="flex items-end gap-2 h-24">
                  {[220, 310, 180, 350, 290, 402, 90].map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className={`w-full rounded-t ${i === 5 ? "bg-gold" : "bg-teal"}`} style={{ height: `${(v / 402) * 100}%` }} />
                      <span className="text-[9px] text-navy-300">{["S", "S", "M", "T", "W", "T", "F"][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              {[
                { label: "AC service — West Bay", amount: "+158", when: "Today 11:20" },
                { label: "Deep AC clean — The Pearl", amount: "+119", when: "Yesterday 15:40" },
                { label: "Weekly payout → QNB ••3401", amount: "−1,650", when: "Last Thu" },
              ].map((tx) => (
                <div key={tx.label} className="card p-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold text-navy">{tx.label}</p>
                    <p className="text-xs text-navy-400">{tx.when}</p>
                  </div>
                  <span className={`font-bold ${tx.amount.startsWith("+") ? "text-teal-dark" : "text-navy-400"}`}>QAR {tx.amount}</span>
                </div>
              ))}
            </div>
            <BottomNav />
          </>
        );

      case "ratings":
        return (
          <>
            <Header title="Ratings & quality" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              <div className="card p-5 text-center">
                <p className="font-display text-4xl font-bold text-navy">4.9 ★</p>
                <p className="text-xs text-navy-400 mt-1">412 rated jobs · top 5% in West Bay</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold text-navy-400 mb-2">AI quality score</p>
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl font-bold text-teal-dark">94</span>
                  <div className="flex-1 h-2 rounded bg-navy-100 overflow-hidden">
                    <span className="block h-full w-[94%] bg-teal" />
                  </div>
                </div>
                <p className="text-xs text-navy-400 mt-2">
                  Punctuality 98 · Checklist 100 · Photos 92 · Chat sentiment 90 · Repeat customers 88
                </p>
              </div>
              {[
                { text: "\"Fixed the AC fast and explained everything.\"", by: "Sara A. · ★★★★★" },
                { text: "\"Very professional, left everything clean.\"", by: "James W. · ★★★★★" },
                { text: "\"Slightly late but great work.\"", by: "Omar F. · ★★★★" },
              ].map((r) => (
                <div key={r.by} className="card p-4 text-sm">
                  <p className="text-navy">{r.text}</p>
                  <p className="text-xs text-navy-400 mt-1">{r.by}</p>
                </div>
              ))}
            </div>
            <BottomNav />
          </>
        );

      case "training":
        return (
          <>
            <Header title="Nest Academy" />
            <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
              <p className="text-xs text-navy-400">
                Certified modules unlock higher-paying job categories.
              </p>
              {[
                { name: "Customer service excellence", progress: 100, badge: "Certified" },
                { name: "AC deep-clean protocol", progress: 100, badge: "Certified" },
                { name: "Safety in the home", progress: 60, badge: "In progress" },
                { name: "Arabic basics for service pros", progress: 20, badge: "In progress" },
                { name: "Electrical L2 certification", progress: 0, badge: "Unlocks +QAR 25/job" },
              ].map((m) => (
                <div key={m.name} className="card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-navy">🎓 {m.name}</p>
                    <span className={`chip ${m.progress === 100 ? "bg-teal-soft text-teal-dark" : "bg-gold-soft text-gold-dark"}`}>{m.badge}</span>
                  </div>
                  <div className="h-1.5 rounded bg-navy-100 overflow-hidden mt-3">
                    <span className="block h-full bg-teal" style={{ width: `${m.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <BottomNav />
          </>
        );
    }
  }

  return (
    <main className="min-h-screen bg-navy-900 py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-white">
          <Link href="/" className="text-xs text-navy-300 hover:text-white">← NEST Solutions</Link>
          <h1 className="font-display text-2xl font-bold mt-1">Provider app — interactive wireframe</h1>
          <p className="text-sm text-navy-300">
            Onboarding & KYC → job requests → navigation → checklist → proof photos → earnings. Offline-first.
          </p>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-10 items-start">
          <aside className="rounded-2xl bg-navy-800 p-5 text-sm sticky top-6">
            <p className="kicker-gold mb-3">Screen map</p>
            {SCREEN_MAP.map((g) => (
              <div key={g.group} className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-navy-300 mb-1.5">{g.group}</p>
                {g.screens.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScreen(s.id)}
                    className={`block w-full text-start rounded-lg px-3 py-1.5 mb-0.5 ${
                      screen === s.id ? "bg-gold text-navy-900 font-semibold" : "text-navy-100 hover:bg-white/5"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          <PhoneFrame>{renderScreen()}</PhoneFrame>
        </div>
      </div>
    </main>
  );
}
