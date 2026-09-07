"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/market/providers/AppState";
import { usePortfolioValuation } from "@/lib/market/usePortfolioValuation";
import { suggestRebalance } from "@/lib/market/rebalance";
import { Panel } from "@/components/market/ui/Panel";
import { KpiCard } from "@/components/market/ui/KpiCard";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { DonutChart } from "@/components/market/charts/DonutChart";
import { UpgradeCTA, LockOverlay } from "@/components/market/ui/UpgradeCTA";
import { ALL_INSTRUMENTS, getInstrument } from "@/lib/market/instruments";
import { fmtQar, fmtNumber, fmtSignedPct, fmtCompact } from "@/lib/market/format";
import { AdvancedAnalytics } from "./AdvancedAnalytics";

const EQUITIES = ALL_INSTRUMENTS.filter(
  (i) => i.assetClass === "equity" || i.assetClass === "index",
);

export function PortfolioTracker() {
  const {
    user,
    plan,
    features,
    portfolios,
    createPortfolio,
    deletePortfolio,
    addHolding,
    removeHolding,
    setCash,
    track,
  } = useAppState();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => track("view_portfolio"), [track]);

  // Keep an active portfolio selected.
  const active =
    portfolios.find((p) => p.id === activeId) ?? portfolios[0] ?? null;
  const { valuation } = usePortfolioValuation(active, plan);

  if (!user) {
    return (
      <Panel title="Portfolio Tracker">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-terminal-muted">Sign in to build and track a portfolio.</p>
          <Link href="/markets/login" className="t-btn-accent">
            Sign in
          </Link>
        </div>
      </Panel>
    );
  }

  const suggestions = valuation ? suggestRebalance(valuation, user.profile?.risk ?? "medium") : [];

  return (
    <div className="space-y-3">
      {/* portfolio selector */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-terminal-border bg-terminal-panel px-3 py-2">
        <span className="t-title">Portfolios</span>
        {portfolios.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`rounded px-2.5 py-1 text-xs font-semibold ${
              active?.id === p.id
                ? "bg-terminal-accent/20 text-terminal-bright"
                : "bg-terminal-panel2 text-terminal-muted hover:text-terminal-text"
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => {
            const res = createPortfolio(`Portfolio ${portfolios.length + 1}`);
            if (!res.ok) setErr(res.error ?? "Could not create portfolio.");
            else setErr(null);
          }}
          className="t-btn"
          title={
            portfolios.length >= features.maxPortfolios
              ? "Plan limit reached"
              : "Create a portfolio"
          }
        >
          + New
        </button>
        <span className="ml-auto text-[10px] text-terminal-muted">
          {portfolios.length}/{features.maxPortfolios} portfolios ({plan})
        </span>
      </div>

      {err && (
        <div className="flex items-center gap-3 rounded-md border border-terminal-warn/30 bg-terminal-warn/10 px-3 py-2 text-xs text-terminal-text">
          <span className="flex-1">{err}</span>
          <UpgradeCTA feature="Multiple portfolios" compact />
        </div>
      )}

      {!active ? (
        <Panel title="Portfolio">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-terminal-muted">Create your first portfolio to get started.</p>
            <button onClick={() => createPortfolio("My Portfolio")} className="t-btn-accent">
              Create portfolio
            </button>
          </div>
        </Panel>
      ) : (
        <>
          {/* KPIs */}
          {valuation && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <KpiCard label="Market Value" value={fmtQar(valuation.totalValue, 0)} sub={`+ cash ${fmtCompact(valuation.cash)}`} />
              <KpiCard
                label="Total P&L"
                value={fmtSignedPct(valuation.pnlPercent)}
                sub={fmtQar(valuation.pnl, 0)}
                accent={valuation.pnl >= 0 ? "up" : "down"}
              />
              <KpiCard
                label="Day Change"
                value={<ChangePill changePercent={valuation.dayChangePercent} size="md" />}
                sub={fmtQar(valuation.dayChange, 0)}
                accent={valuation.dayChange >= 0 ? "up" : "down"}
              />
              <KpiCard label="Cost Basis" value={fmtQar(valuation.totalCost, 0)} />
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            {/* holdings + add form */}
            <div className="space-y-3 lg:col-span-2">
              <AddHoldingForm
                onAdd={(h) => addHolding(active.id, h)}
              />
              <Panel
                title="Holdings"
                actions={
                  portfolios.length > 1 ? (
                    <button
                      onClick={() => {
                        deletePortfolio(active.id);
                        setActiveId(null);
                      }}
                      className="t-btn text-terminal-down"
                    >
                      Delete portfolio
                    </button>
                  ) : undefined
                }
                bodyClassName="p-1.5"
              >
                {active.holdings.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-terminal-muted">
                    No holdings yet — add a position above.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-terminal-muted">
                        <th className="px-2 py-1 text-left">Symbol</th>
                        <th className="px-2 py-1 text-right">Qty</th>
                        <th className="px-2 py-1 text-right">Avg</th>
                        <th className="px-2 py-1 text-right">Last</th>
                        <th className="px-2 py-1 text-right">Value</th>
                        <th className="px-2 py-1 text-right">P&L</th>
                        <th className="px-2 py-1 text-right">Wt</th>
                        <th className="w-6" />
                      </tr>
                    </thead>
                    <tbody>
                      {valuation?.rows.map((r) => (
                        <tr key={r.holding.id} className="group border-t border-terminal-border/60">
                          <td className="px-2 py-1.5">
                            <Link
                              href={`/markets/symbol/${r.holding.symbol}`}
                              className="font-bold text-terminal-bright hover:underline"
                            >
                              {r.holding.symbol}
                            </Link>
                          </td>
                          <td className="num px-2 py-1.5 text-right text-terminal-text">
                            {fmtNumber(r.holding.quantity, 0)}
                          </td>
                          <td className="num px-2 py-1.5 text-right text-terminal-muted">
                            {fmtNumber(r.holding.avgPrice, 2)}
                          </td>
                          <td className="num px-2 py-1.5 text-right text-terminal-text">
                            {fmtNumber(r.price, 2)}
                          </td>
                          <td className="num px-2 py-1.5 text-right text-terminal-text">
                            {fmtNumber(r.marketValue, 0)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <div className={r.pnl >= 0 ? "text-terminal-up" : "text-terminal-down"}>
                              <div className="num">{fmtSignedPct(r.pnlPercent)}</div>
                              <div className="num text-[10px] opacity-80">
                                {fmtNumber(r.pnl, 0)}
                              </div>
                            </div>
                          </td>
                          <td className="num px-2 py-1.5 text-right text-terminal-muted">
                            {fmtNumber(r.weight, 1)}%
                          </td>
                          <td className="px-1 text-right">
                            <button
                              onClick={() => removeHolding(active.id, r.holding.id)}
                              className="text-terminal-muted opacity-0 transition group-hover:opacity-100 hover:text-terminal-down"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="mt-2 flex items-center gap-2 border-t border-terminal-border px-2 pt-2 text-xs">
                  <span className="text-terminal-muted">Cash (QAR)</span>
                  <input
                    type="number"
                    defaultValue={active.cash}
                    onBlur={(e) => setCash(active.id, parseFloat(e.target.value) || 0)}
                    className="t-input num w-32 py-1"
                  />
                </div>
              </Panel>
            </div>

            {/* allocation + rebalancing */}
            <div className="space-y-3">
              <Panel title="Allocation by Sector">
                {valuation && valuation.allocationBySector.length > 0 ? (
                  <DonutChart
                    size={170}
                    slices={valuation.allocationBySector.map((a) => ({
                      label: a.label,
                      value: a.value,
                    }))}
                    centerValue={fmtCompact(valuation.totalValue)}
                    centerLabel="QAR"
                  />
                ) : (
                  <p className="py-6 text-center text-xs text-terminal-muted">
                    Add holdings to see allocation.
                  </p>
                )}
              </Panel>

              <Panel title="Rebalancing Suggestions">
                <ul className="space-y-2">
                  {suggestions.map((s) => (
                    <li
                      key={s.id}
                      className={`rounded border-l-2 bg-terminal-panel2 px-2.5 py-2 text-xs ${
                        s.severity === "critical"
                          ? "border-terminal-down"
                          : s.severity === "warn"
                            ? "border-terminal-warn"
                            : "border-terminal-accent"
                      }`}
                    >
                      <div className="font-semibold text-terminal-bright">{s.title}</div>
                      <p className="mt-0.5 text-terminal-muted">{s.detail}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-terminal-muted">
                  Rule-based nudges, not investment advice.
                </p>
              </Panel>
            </div>
          </div>

          {/* advanced analytics (premium) */}
          {features.advancedAnalytics ? (
            valuation && <AdvancedAnalytics valuation={valuation} />
          ) : (
            <LockOverlay
              feature="Advanced portfolio analytics"
              message="Risk metrics & scenario analysis are a Premium feature."
            >
              {valuation && <AdvancedAnalytics valuation={valuation} />}
            </LockOverlay>
          )}
        </>
      )}
    </div>
  );
}

function AddHoldingForm({ onAdd }: { onAdd: (h: { symbol: string; quantity: number; avgPrice: number }) => void }) {
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [avg, setAvg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    const inst = getInstrument(sym);
    const q = parseFloat(qty);
    const a = parseFloat(avg);
    if (!inst || !Number.isFinite(q) || q <= 0 || !Number.isFinite(a) || a <= 0) return;
    onAdd({ symbol: sym, quantity: q, avgPrice: a });
    setSymbol("");
    setQty("");
    setAvg("");
  };

  return (
    <Panel title="Add Holding">
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-terminal-muted">
            Symbol
          </span>
          <input
            list="qmd-symbols"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="QNBK"
            className="t-input num"
          />
          <datalist id="qmd-symbols">
            {EQUITIES.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.name}
              </option>
            ))}
          </datalist>
        </label>
        <label className="w-24">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-terminal-muted">
            Quantity
          </span>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            placeholder="100"
            className="t-input num"
          />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-terminal-muted">
            Avg price
          </span>
          <input
            value={avg}
            onChange={(e) => setAvg(e.target.value)}
            inputMode="decimal"
            placeholder="16.20"
            className="t-input num"
          />
        </label>
        <button type="submit" className="t-btn-accent">
          Add
        </button>
      </form>
    </Panel>
  );
}
