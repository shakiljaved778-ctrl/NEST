"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SERVICES, ZONES, getService, getZone } from "@/lib/catalog";
import { PROVIDERS } from "@/lib/providers";
import { COUPONS } from "@/lib/pricing";
import type { PilotScoreboard } from "@/lib/pilot";
import type { Booking } from "@/lib/types";

type Tab =
  | "overview"
  | "pilot"
  | "bookings"
  | "providers"
  | "catalog"
  | "pricing"
  | "complaints"
  | "coupons"
  | "heatmap"
  | "fraud";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "overview", icon: "📊", label: "Overview" },
  { id: "pilot", icon: "🎯", label: "Pilot scoreboard" },
  { id: "bookings", icon: "📋", label: "Bookings" },
  { id: "providers", icon: "🪪", label: "Providers" },
  { id: "catalog", icon: "🗂️", label: "Service catalog" },
  { id: "pricing", icon: "💰", label: "Pricing engine" },
  { id: "complaints", icon: "🛟", label: "Disputes & refunds" },
  { id: "coupons", icon: "🎟️", label: "Coupons" },
  { id: "heatmap", icon: "🗺️", label: "Ops heatmap" },
  { id: "fraud", icon: "🛡️", label: "Fraud monitor" },
];

const STATUS_TONE: Record<string, string> = {
  pending_match: "bg-gold-soft text-gold-dark",
  matched: "bg-teal-soft text-teal-dark",
  accepted: "bg-teal-soft text-teal-dark",
  en_route: "bg-navy-50 text-navy-500",
  arrived: "bg-navy-50 text-navy-500",
  in_progress: "bg-navy text-white",
  completed: "bg-teal text-white",
  cancelled: "bg-red-50 text-red-600",
};

const COMPLAINTS = [
  { id: "C-311", booking: "NB-1038", category: "late_arrival", priority: "medium", text: "Plumber is 35 minutes late, customer waiting.", escalated: false, refund: null },
  { id: "C-310", booking: "NB-1036", category: "damage_claim", priority: "high", text: "Customer reports a stained rug after pest treatment.", escalated: true, refund: "QAR 80 pending approval" },
  { id: "C-309", booking: "NB-1032", category: "poor_quality", priority: "medium", text: "AC still noisy after deep clean, rework requested.", escalated: false, refund: null },
];

/** Example patterns shown when the live scan (GET /api/admin/fraud) finds nothing. */
const FRAUD_EXAMPLES = [
  { id: "F-88", type: "coupon_abuse", entity: "Customer +974 ••2231", score: 0.82, signal: "6 accounts, same device, NEST10 reuse", suggestedAction: "Block coupons" },
  { id: "F-87", type: "rating_manipulation", entity: "Provider p9", score: 0.64, signal: "Rating burst from 3 linked accounts", suggestedAction: "Review" },
  { id: "F-86", type: "refund_abuse", entity: "Customer +974 ••8817", score: 0.58, signal: "4 refund claims in 30 days, no photos", suggestedAction: "Manual review" },
];

interface FraudFlagRow {
  id: string;
  type: string;
  entity: string;
  score: number;
  signal: string;
  suggestedAction: string;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [stats, setStats] = useState<{ bookingsToday: number; gmvToday: number; activeProviders: number; avgRating: number } | null>(null);
  const [pilot, setPilot] = useState<PilotScoreboard | null>(null);
  const [fraudFlags, setFraudFlags] = useState<FraudFlagRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/pilot")
      .then((r) => r.json())
      .then(setPilot)
      .catch(() => setPilot(null));
    fetch("/api/admin/fraud")
      .then((r) => r.json())
      .then((d) => setFraudFlags(d.flags ?? []))
      .catch(() => setFraudFlags([]));
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings ?? []))
      .catch(() => setBookings([]));
    fetch("/api/admin/summary")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary ?? "");
        setStats(d.stats ?? null);
      })
      .catch(() => null);
  }, []);

  const revenueByService = SERVICES.map((s) => ({
    service: s,
    total: bookings.filter((b) => b.serviceId === s.id && b.status !== "cancelled").reduce((sum, b) => sum + b.quote.total, 0),
  }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxRevenue = Math.max(1, ...revenueByService.map((r) => r.total));

  function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
    return (
      <div className="card p-5">
        <p className="text-xs font-semibold text-navy-400">{label}</p>
        <p className={`font-display text-2xl font-bold mt-1 ${tone ?? "text-navy"}`}>{value}</p>
        {sub && <p className="text-xs text-navy-400 mt-1">{sub}</p>}
      </div>
    );
  }

  function renderTab() {
    switch (tab) {
      case "overview":
        return (
          <div className="space-y-6">
            <div className="card !bg-navy-800 !border-navy-700 p-5 text-white">
              <p className="kicker-gold mb-2">✦ AI daily summary</p>
              <p className="text-sm leading-relaxed text-navy-100">{summary || "Loading Nest AI summary…"}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Bookings today" value={String(stats?.bookingsToday ?? "—")} sub="across 8 zones" />
              <Kpi label="GMV today" value={`QAR ${stats?.gmvToday?.toLocaleString() ?? "—"}`} sub="20% blended take rate" tone="text-teal-dark" />
              <Kpi label="Active providers" value={String(stats?.activeProviders ?? "—")} sub="of 60 pilot target" />
              <Kpi label="Avg rating" value={stats ? `${stats.avgRating.toFixed(1)} ★` : "—"} sub="last 7 days" tone="text-gold-dark" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card p-5">
                <p className="font-display font-bold text-navy mb-4">Revenue by service (live)</p>
                <div className="space-y-2.5">
                  {revenueByService.slice(0, 6).map((r) => (
                    <div key={r.service.id} className="flex items-center gap-3 text-sm">
                      <span className="w-36 shrink-0 text-navy-600 truncate">{r.service.icon} {r.service.name}</span>
                      <div className="flex-1 h-4 rounded bg-navy-50 overflow-hidden">
                        <span className={`block h-full ${r.service.accent === "gold" ? "bg-gold" : r.service.accent === "teal" ? "bg-teal" : "bg-navy"}`} style={{ width: `${(r.total / maxRevenue) * 100}%` }} />
                      </div>
                      <span className="w-20 text-end font-semibold text-navy">QAR {r.total}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5">
                <p className="font-display font-bold text-navy mb-4">Live booking feed</p>
                <div className="space-y-2 text-sm">
                  {bookings.slice(0, 6).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 py-1.5 border-b border-navy-50 last:border-0">
                      <span className="text-lg">{getService(b.serviceId)?.icon}</span>
                      <span className="flex-1">
                        <span className="font-semibold text-navy">{b.id}</span>
                        <span className="text-navy-400"> · {getZone(b.zoneId)?.name} · {b.slot}</span>
                      </span>
                      <span className={`chip ${STATUS_TONE[b.status]}`}>{b.status.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "pilot": {
        if (!pilot) return <div className="card p-8 text-sm text-navy-400">Loading pilot scoreboard…</div>;
        const GATE_TONE: Record<string, string> = {
          achieved: "bg-teal text-white",
          on_track: "bg-gold-soft text-gold-dark",
          at_risk: "bg-red-50 text-red-600",
        };
        const GATE_LABEL: Record<string, string> = { achieved: "✓ achieved", on_track: "on track", at_risk: "⚠ at risk" };
        const fmt = (g: (typeof pilot.gates)[number], v: number) =>
          g.unit === "qar" ? `QAR ${v.toLocaleString()}` : g.unit === "percent" ? `${v}%` : v.toLocaleString();
        return (
          <div className="space-y-6">
            <div className="card !bg-navy-800 !border-navy-700 p-5 text-white flex flex-wrap items-center gap-6">
              <div>
                <p className="kicker-gold mb-1">🎯 90-day Doha pilot → Seed gate</p>
                <p className="font-display text-2xl font-bold">Day {pilot.day} of 90</p>
                <p className="text-xs text-navy-200 mt-1">{pilot.daysRemaining} days remaining · 2 beachhead zones · 5 pilot services</p>
              </div>
              <div className="ms-auto">
                <span className={`chip ${pilot.seedReady ? "bg-teal text-white" : "bg-gold text-navy-800"}`}>
                  {pilot.seedReady ? "✓ Seed-ready — all gates passed" : `${pilot.gates.filter((g) => g.status === "achieved").length} of ${pilot.gates.length} gates passed`}
                </span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pilot.gates.map((g) => {
                const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                return (
                  <div key={g.id} className="card p-5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-navy text-sm">{g.label}</p>
                      <span className={`chip ${GATE_TONE[g.status]}`}>{GATE_LABEL[g.status]}</span>
                    </div>
                    <p className="font-display text-2xl font-bold text-navy">
                      {fmt(g, g.current)}
                      <span className="text-sm font-normal text-navy-400">
                        {" "}/ {fmt(g, g.target)}{g.targetMax ? `–${g.targetMax.toLocaleString()}` : ""}
                      </span>
                    </p>
                    <div className="h-2 rounded bg-navy-50 overflow-hidden mt-3">
                      <span
                        className={`block h-full ${g.status === "achieved" ? "bg-teal" : g.status === "on_track" ? "bg-gold" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-navy-400 mt-2">{g.detail}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-navy-400">
              Gates from the business plan: live MVP · 40–60 verified providers · 2 Doha zones · 1,500–3,000 bookings ·
              &gt;40% repeat rate · QAR 500k GMV run-rate. Pass all gates → open the Seed round.
            </p>
          </div>
        );
      }

      case "bookings":
        return (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-navy text-white text-start">
                  {["Booking", "Service", "Customer", "Zone", "Slot", "Total", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-navy-50 last:border-0 hover:bg-pearl">
                    <td className="px-4 py-3 font-semibold text-navy">{b.id}</td>
                    <td className="px-4 py-3">{getService(b.serviceId)?.icon} {getService(b.serviceId)?.name}</td>
                    <td className="px-4 py-3 text-navy-500">{b.customerName}</td>
                    <td className="px-4 py-3 text-navy-500">{getZone(b.zoneId)?.name}</td>
                    <td className="px-4 py-3 text-navy-500">{b.date} {b.slot}</td>
                    <td className="px-4 py-3 font-semibold text-navy">QAR {b.quote.total}</td>
                    <td className="px-4 py-3"><span className={`chip ${STATUS_TONE[b.status]}`}>{b.status.replace(/_/g, " ")}</span></td>
                    <td className="px-4 py-3">
                      {b.status === "pending_match" && <button className="chip bg-gold text-navy-800">Assign manually</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "providers":
        return (
          <div className="space-y-4">
            <div className="card p-4 flex items-center justify-between bg-gold-soft !border-gold/40">
              <p className="text-sm font-semibold text-navy">🪪 Verification queue: <b>3 providers</b> awaiting document review</p>
              <button className="chip bg-navy text-white">Open queue</button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-navy text-white">
                    {["Provider", "Skills", "Zones", "Rating", "Jobs", "Completion", "Response", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-start font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROVIDERS.map((p) => (
                    <tr key={p.id} className="border-b border-navy-50 last:border-0 hover:bg-pearl">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-navy">{p.name}</span>
                        <span className="block text-xs text-navy-400">{p.languages.join(", ").toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-3 text-navy-500">{p.skills.map((s) => getService(s)?.icon).join(" ")}</td>
                      <td className="px-4 py-3 text-navy-500 text-xs">{p.zones.map((z) => getZone(z)?.name).join(", ")}</td>
                      <td className="px-4 py-3 font-semibold text-navy">★ {p.rating}</td>
                      <td className="px-4 py-3 text-navy-500">{p.jobsDone}</td>
                      <td className="px-4 py-3 text-navy-500">{Math.round(p.completionRate * 100)}%</td>
                      <td className="px-4 py-3 text-navy-500">{p.responseMinutes}m</td>
                      <td className="px-4 py-3"><span className="chip bg-teal-soft text-teal-dark">✓ Verified</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "catalog":
        return (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.id} className="card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${s.accent === "teal" ? "bg-teal text-white" : s.accent === "gold" ? "bg-gold text-navy-800" : "bg-navy text-white"}`}>{s.icon}</span>
                  <div>
                    <p className="font-bold text-navy text-sm">{s.name}</p>
                    <p className="text-xs text-navy-400" dir="rtl">{s.nameAr}</p>
                  </div>
                  <span className="chip bg-teal-soft text-teal-dark ms-auto">Active</span>
                </div>
                <ul className="text-xs text-navy-500 space-y-1">
                  {s.packages.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>{p.name}</span>
                      <span className="font-semibold text-navy">QAR {p.price}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-navy-400 mt-2">{s.addons.length} add-ons · {s.genderPreference ? "gender preference" : "any provider"}</p>
              </div>
            ))}
          </div>
        );

      case "pricing":
        return (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5 space-y-4">
              <p className="font-display font-bold text-navy">Dynamic pricing rules</p>
              {[
                { rule: "Peak-hour uplift (17:00–21:00)", value: "+10%", on: true },
                { rule: "Urgency surcharge (< 2h)", value: "+QAR 30", on: true },
                { rule: "Nest+ subscriber discount", value: "−10%", on: true },
                { rule: "Summer AC demand uplift (Jun–Sep)", value: "+8%", on: false },
                { rule: "Low-supply zone uplift", value: "+5–12% (AI)", on: false },
              ].map((r) => (
                <div key={r.rule} className="flex items-center justify-between text-sm border-b border-navy-50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-navy">{r.rule}</p>
                    <p className="text-xs text-navy-400">{r.value}</p>
                  </div>
                  <span className={`h-6 w-11 rounded-full p-0.5 ${r.on ? "bg-teal" : "bg-navy-100"}`}>
                    <span className={`block h-5 w-5 rounded-full bg-white transition ${r.on ? "translate-x-5" : ""}`} />
                  </span>
                </div>
              ))}
            </div>
            <div className="card p-5">
              <p className="font-display font-bold text-navy mb-4">Commission by category</p>
              {[
                { cat: "Cleaning services", rate: "15–25%", fill: 70 },
                { cat: "Technical (AC / plumbing / electrical)", rate: "10–20%", fill: 55 },
                { cat: "Salon-at-home", rate: "20–30%", fill: 85 },
                { cat: "Care (nanny / elderly)", rate: "Service-fee model", fill: 40 },
                { cat: "Corporate contracts", rate: "Negotiated", fill: 30 },
              ].map((c) => (
                <div key={c.cat} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-navy-600">{c.cat}</span>
                    <span className="font-semibold text-navy">{c.rate}</span>
                  </div>
                  <div className="h-2 rounded bg-navy-50 overflow-hidden">
                    <span className="block h-full bg-gold" style={{ width: `${c.fill}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-navy-400 mt-4">
                ✦ AI suggestion: raise AC service base by 5% in West Bay evenings — demand outstrips supply 3:1.
              </p>
            </div>
          </div>
        );

      case "complaints":
        return (
          <div className="space-y-4">
            {COMPLAINTS.map((c) => (
              <div key={c.id} className={`card p-5 ${c.escalated ? "!border-red-200 ring-2 ring-red-100" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-bold text-navy">{c.id}</span>
                  <span className="text-xs text-navy-400">on {c.booking}</span>
                  <span className="chip bg-navy text-white">{c.category.replace(/_/g, " ")}</span>
                  <span className={`chip ${c.priority === "high" ? "bg-red-50 text-red-600" : "bg-gold-soft text-gold-dark"}`}>{c.priority}</span>
                  {c.escalated && <span className="chip bg-red-600 text-white">⚠ human escalation</span>}
                </div>
                <p className="text-sm text-navy-600">{c.text}</p>
                <p className="text-[11px] text-teal-dark mt-1">✦ Classified by Nest AI · sentiment: negative</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {c.refund && <span className="chip bg-gold-soft text-gold-dark">💸 {c.refund}</span>}
                  <button className="chip bg-teal text-white">Resolve</button>
                  <button className="chip bg-white border border-navy-200 text-navy">Contact customer</button>
                  {c.refund && <button className="chip bg-navy text-white">Approve refund</button>}
                </div>
              </div>
            ))}
          </div>
        );

      case "coupons":
        return (
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(COUPONS).map(([code, c]) => (
              <div key={code} className="card p-5 border-dashed">
                <p className="font-mono text-lg font-bold text-navy">{code}</p>
                <p className="text-sm text-navy-500 mt-1">{c.label}</p>
                <div className="flex justify-between text-xs text-navy-400 mt-4">
                  <span>Used {code === "NEST10" ? 214 : code === "SALAM15" ? 158 : 63}×</span>
                  <span className="chip bg-teal-soft text-teal-dark">Active</span>
                </div>
              </div>
            ))}
            <button className="card p-5 border-dashed text-navy-400 hover:text-navy font-semibold">+ New campaign</button>
          </div>
        );

      case "heatmap":
        return (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="card p-5">
              <p className="font-display font-bold text-navy mb-4">Demand vs supply by zone (today)</p>
              <div className="grid grid-cols-4 gap-3">
                {ZONES.map((z) => {
                  const demand = { "west-bay": 92, "the-pearl": 78, lusail: 66, "al-sadd": 41, "al-rayyan": 35, "al-wakrah": 28, msheireb: 52, "al-khor": 12 }[z.id] ?? 20;
                  const tone = demand > 70 ? "bg-red-500" : demand > 45 ? "bg-gold" : "bg-teal";
                  return (
                    <div key={z.id} className="rounded-xl bg-pearl p-3 text-center">
                      <span className={`mx-auto mb-2 block h-10 w-10 rounded-full ${tone} opacity-90`} style={{ transform: `scale(${0.6 + demand / 150})` }} />
                      <p className="text-xs font-bold text-navy">{z.name}</p>
                      <p className="text-[10px] text-navy-400">{demand}% capacity</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-navy-400 mt-4">🔴 supply gap · 🟡 tightening · 🟢 healthy</p>
            </div>
            <div className="space-y-4">
              <div className="card p-5">
                <p className="font-bold text-navy text-sm mb-2">⚠ SLA alerts</p>
                <ul className="text-xs text-navy-500 space-y-2">
                  <li>• West Bay evening AC: 3 unfilled slots — activate standby pros</li>
                  <li>• NB-1038 pending match 22 min (SLA 15) — assign manually</li>
                </ul>
              </div>
              <div className="card p-5">
                <p className="font-bold text-navy text-sm mb-2">✦ AI demand forecast</p>
                <p className="text-xs text-navy-500">
                  Friday +34% cleaning demand expected (end-of-month). The Pearl salon-at-home trending +18% WoW. Consider a PEARL25 push campaign.
                </p>
              </div>
            </div>
          </div>
        );

      case "fraud": {
        const liveScanClean = fraudFlags.length === 0;
        const rows = liveScanClean ? FRAUD_EXAMPLES : fraudFlags;
        return (
          <div className="space-y-4">
            <div className={`card p-4 text-sm font-semibold ${liveScanClean ? "bg-teal-soft !border-teal/40 text-teal-dark" : "bg-red-50 !border-red-200 text-red-600"}`}>
              {liveScanClean
                ? "✓ Live scan clean — no fraud flags in current marketplace data. Showing example patterns the detector watches for."
                : `⚠ ${fraudFlags.length} live fraud flag${fraudFlags.length === 1 ? "" : "s"} need review.`}
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-navy text-white">
                    {["Flag", "Type", "Entity", "Risk score", "Signal", "Action"].map((h) => (
                      <th key={h} className="px-4 py-3 text-start font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f) => (
                    <tr key={f.id} className="border-b border-navy-50 last:border-0 hover:bg-pearl">
                      <td className="px-4 py-3 font-semibold text-navy">{f.id}</td>
                      <td className="px-4 py-3">{f.type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-navy-500">{f.entity}</td>
                      <td className="px-4 py-3">
                        <span className={`chip ${f.score > 0.7 ? "bg-red-50 text-red-600" : "bg-gold-soft text-gold-dark"}`}>
                          {(f.score * 100).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-navy-500">{f.signal}</td>
                      <td className="px-4 py-3"><button className="chip bg-navy text-white">{f.suggestedAction}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
    }
  }

  return (
    <main className="min-h-screen bg-pearl">
      <div className="flex min-h-screen">
        {/* sidebar */}
        <aside className="w-60 shrink-0 bg-navy-800 text-white flex flex-col">
          <Link href="/" className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-navy-800 text-lg">⌂</span>
            <span className="font-display font-bold">NEST Admin</span>
          </Link>
          <nav className="flex-1 py-4 overflow-y-auto">
            {TABS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-3 px-5 py-2.5 text-sm ${
                  tab === item.id ? "bg-white/10 text-white font-semibold border-s-2 border-gold" : "text-navy-200 hover:bg-white/5"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <p className="px-5 py-4 text-[11px] text-navy-300 border-t border-white/10">
            Ops control room · Doha HQ<br />RBAC: super-admin
          </p>
        </aside>

        {/* content */}
        <div className="flex-1 min-w-0">
          <header className="bg-white border-b border-navy-100 px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-navy">{TABS.find((x) => x.id === tab)?.label}</h1>
              <p className="text-xs text-navy-400">Live marketplace · Qatar · {new Date().toDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="chip bg-teal-soft text-teal-dark">● All systems normal</span>
              <span className="h-9 w-9 rounded-full bg-navy text-gold font-bold flex items-center justify-center text-sm">OP</span>
            </div>
          </header>
          <div className="p-8">{renderTab()}</div>
        </div>
      </div>
    </main>
  );
}
