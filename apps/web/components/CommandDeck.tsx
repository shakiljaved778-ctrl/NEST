"use client";

import { useRef, useState } from "react";
import {
  formatMoney,
  type TripPresentation,
  type TripOption,
} from "@voyara/contracts";
import { ForecastCurve } from "./ForecastCurve";

const EXAMPLES = [
  "3 nights in Istanbul next weekend, boutique, under $150/night, near Sultanahmet",
  "2 nights in Tokyo next week, design hotel near Shibuya",
  "4 nights in Dubai, business, near DIFC",
];

type CheckoutResult = {
  bookingId: string;
  status: string;
  pnrRefs: Record<string, string>;
  totalCharged: { amountMinor: number; currency: string };
  walletApplied: { amountMinor: number; currency: string };
  ledgerBalanced: boolean;
};

export function CommandDeck() {
  const [intent, setIntent] = useState(EXAMPLES[0]!);
  const [lines, setLines] = useState<string[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [presentation, setPresentation] = useState<TripPresentation | null>(null);
  const [working, setWorking] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function plan() {
    if (!intent.trim() || working) return;
    setWorking(true);
    setLines([]);
    setGaps([]);
    setPresentation(null);
    setCheckout(null);

    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intentText: intent }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        if (!part.trim()) continue;
        const e = JSON.parse(part);
        if (e.type === "narrate") setLines((l) => [...l, e.message]);
        else if (e.type === "gap") setGaps((g) => [...g, e.message]);
        else if (e.type === "present") setPresentation(e.presentation);
        listRef.current?.scrollTo({ top: 1e6 });
      }
    }
    setWorking(false);
  }

  async function book(option: TripOption) {
    setWorking(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ option, userId: "demo-user", applyWallet: true }),
    });
    setCheckout(await res.json());
    setWorking(false);
  }

  return (
    <div className="grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-6">
      {/* ── Intent + narration ── */}
      <section className="flex flex-col gap-4">
        <div className="rounded-2xl bg-navy-900/70 ring-1 ring-white/5 shadow-card p-5">
          <label className="text-xs uppercase tracking-widest text-gold/80">
            State your intent — once
          </label>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) plan();
            }}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl bg-navy-950/80 ring-1 ring-white/10 focus:ring-gold/50 outline-none p-3 text-cream placeholder:text-cream/30"
            placeholder="3 nights in Istanbul next weekend, boutique, under $150/night…"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setIntent(ex)}
                className="text-[11px] text-cream/60 hover:text-gold rounded-full px-2.5 py-1 ring-1 ring-white/10"
              >
                {ex.split(",")[0]}
              </button>
            ))}
          </div>
          <button
            onClick={plan}
            disabled={working}
            className="mt-4 w-full rounded-xl bg-gold text-navy-950 font-semibold py-2.5 hover:bg-gold-soft transition disabled:opacity-50"
          >
            {working ? "Voyara is working…" : "Delegate to Voyara"}
          </button>
        </div>

        <div
          ref={listRef}
          className="rounded-2xl bg-navy-900/50 ring-1 ring-white/5 p-5 min-h-[180px] max-h-[46vh] overflow-y-auto"
        >
          <div className="text-xs uppercase tracking-widest text-cream/40 mb-3">
            Agent narration
          </div>
          {lines.length === 0 && !working && (
            <p className="text-cream/30 text-sm">
              No results pages. No search grid. Intent in → one assembled trip out.
            </p>
          )}
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li
                key={i}
                className={`text-sm text-cream/85 animate-slidein ${
                  i === lines.length - 1 && working ? "narration-cursor" : ""
                }`}
              >
                {l}
              </li>
            ))}
          </ul>
          {gaps.map((g, i) => (
            <p key={i} className="mt-2 text-xs text-amber-guardian">
              ⚠ {g}
            </p>
          ))}
        </div>
      </section>

      {/* ── Trip board ── */}
      <section className="space-y-4">
        {!presentation && (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-cream/30">
            The assembled trip and two alternates will appear here.
          </div>
        )}

        {presentation?.clarifyingQuestion && (
          <div className="rounded-xl bg-slateblue/15 ring-1 ring-slateblue/40 p-4 text-cream">
            {presentation.clarifyingQuestion}
          </div>
        )}

        {presentation && (
          <>
            <OptionCard
              option={presentation.primary}
              primary
              expanded={expanded === presentation.primary.id}
              onToggle={() =>
                setExpanded(expanded === presentation.primary.id ? null : presentation.primary.id)
              }
              onBook={() => book(presentation.primary)}
              working={working}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              {presentation.alternates.map((alt) => (
                <OptionCard
                  key={alt.id}
                  option={alt}
                  expanded={expanded === alt.id}
                  onToggle={() => setExpanded(expanded === alt.id ? null : alt.id)}
                  onBook={() => book(alt)}
                  working={working}
                />
              ))}
            </div>
          </>
        )}

        {checkout && (
          <div className="rounded-2xl bg-rebate/10 ring-1 ring-rebate/40 p-5 animate-slidein">
            <div className="flex items-center gap-2 text-rebate font-semibold">
              ✓ Booking {checkout.status.toLowerCase()} · {checkout.bookingId}
            </div>
            <div className="mt-2 text-sm text-cream/80">
              Charged {formatMoney(checkout.totalCharged)} · wallet applied{" "}
              {formatMoney(checkout.walletApplied)} · PNR{" "}
              {Object.values(checkout.pnrRefs).join(", ")}
            </div>
            <div className="mt-1 text-xs text-cream/40">
              Double-entry ledger balanced: {String(checkout.ledgerBalanced)} · guardian now
              watching this trip until you are home.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OptionCard({
  option,
  primary,
  expanded,
  onToggle,
  onBook,
  working,
}: {
  option: TripOption;
  primary?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onBook: () => void;
  working: boolean;
}) {
  const buy = option.forecast.verdict === "BUY";
  const hotel = option.segments.find((s) => s.kind === "HOTEL")?.offer;
  return (
    <div
      className={`rounded-2xl p-5 animate-slidein ${
        primary
          ? "bg-navy-800/70 ring-1 ring-gold/30 shadow-glow"
          : "bg-navy-900/60 ring-1 ring-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-gold/70">
            {option.label}
          </div>
          <h3 className="font-display text-xl text-cream mt-1">{hotel?.title}</h3>
          <div className="text-xs text-cream/50">
            {hotel?.neighborhood}, {hotel?.city} · {hotel?.rating}★ ({hotel?.reviewCount})
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            buy ? "bg-gold/20 text-gold" : "bg-slateblue/20 text-slateblue"
          }`}
        >
          {option.forecast.verdict} · {(option.forecast.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold text-cream">
            {formatMoney(option.totalPrice)}
          </div>
          <div className="text-xs text-cream/40">
            fit {(option.fitScore * 100).toFixed(0)}%
            {hotel?.perNight ? ` · ${formatMoney(hotel.perNight)}/night` : ""}
          </div>
        </div>
        <ForecastCurve curve={option.forecast.curve} verdict={option.forecast.verdict} />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onBook}
          disabled={working}
          className="flex-1 rounded-xl bg-gold text-navy-950 font-semibold py-2 hover:bg-gold-soft transition disabled:opacity-50"
        >
          Book & guard
        </button>
        {!buy && (
          <button
            className="rounded-xl px-3 py-2 text-sm ring-1 ring-slateblue/50 text-slateblue hover:bg-slateblue/10"
            title="Lock this price while you decide"
          >
            Freeze price
          </button>
        )}
        <button
          onClick={onToggle}
          className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 text-cream/70 hover:text-gold"
        >
          Why?
        </button>
      </div>

      {expanded && (
        <div className="mt-4 rounded-xl bg-navy-950/60 ring-1 ring-white/5 p-4 text-sm">
          <div className="text-cream/60 mb-2">Fit-score breakdown</div>
          <ul className="space-y-1">
            {Object.entries(option.fitBreakdown.contributions).map(([k, v]) => (
              <li key={k} className="flex justify-between text-cream/70">
                <span>{k}</span>
                <span className="text-gold/80">+{v.toFixed(3)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-cream/60">Signals</div>
          <ul className="list-disc list-inside text-cream/70">
            {option.fitBreakdown.signals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-cream/50 italic">{option.forecast.rationale}</p>
          <p className="mt-2 text-[11px] text-rebate/80">
            No supplier margin entered this score. Ranking is fit only.
          </p>
        </div>
      )}
    </div>
  );
}
