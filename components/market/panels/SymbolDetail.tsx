"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/market/providers/AppState";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { Panel } from "@/components/market/ui/Panel";
import { KpiCard } from "@/components/market/ui/KpiCard";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { DemoBadge } from "@/components/market/ui/DemoBadge";
import { SkeletonRows } from "@/components/market/ui/Skeleton";
import { UpgradeCTA } from "@/components/market/ui/UpgradeCTA";
import { CandleChart } from "@/components/market/charts/CandleChart";
import { NewsFeed } from "./NewsFeed";
import { AlertForm } from "./AlertForm";
import { getInstrument, SECTOR_LABEL } from "@/lib/market/instruments";
import { fmtNumber, fmtMarketCap, fmtTime, fmtCompact } from "@/lib/market/format";
import type { Timeframe } from "@/types/market";

const TIMEFRAMES: { id: Timeframe; label: string; intraday: boolean }[] = [
  { id: "1m", label: "1m", intraday: true },
  { id: "5m", label: "5m", intraday: true },
  { id: "15m", label: "15m", intraday: true },
  { id: "1h", label: "1H", intraday: true },
  { id: "1d", label: "1D", intraday: false },
];

const SMA_OPTIONS = [20, 50, 200];

export function SymbolDetail({ symbol }: { symbol: string }) {
  const { plan, features, user, watchlist, toggleWatch, track } = useAppState();
  const [tf, setTf] = useState<Timeframe>("1d");
  const [smas, setSmas] = useState<number[]>([20]);
  const inst = getInstrument(symbol);

  useEffect(() => track("view_symbol", { symbol }), [symbol, track]);

  const bars = useAsync(() => marketApi.bars(symbol, tf, plan), [symbol, tf, plan], {
    refetchInterval: plan === "premium" ? 5000 : 30000,
  });
  const fund = useAsync(() => marketApi.fundamentals(symbol), [symbol]);

  const q = bars.data?.quote;
  const tfMeta = TIMEFRAMES.find((t) => t.id === tf)!;
  const watched = watchlist.includes(symbol.toUpperCase());
  const activeSmas = smas.slice(0, features.maxIndicators);

  const toggleSma = (p: number) => {
    setSmas((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-terminal-border bg-terminal-panel px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-terminal-bright">{symbol.toUpperCase()}</h1>
            {inst && (
              <span className="t-chip bg-terminal-panel2 text-terminal-muted">
                {inst.market}
              </span>
            )}
            {inst?.sector && (
              <span className="t-chip bg-terminal-panel2 text-terminal-muted">
                {SECTOR_LABEL[inst.sector]}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-terminal-muted">{inst?.name ?? symbol}</p>
        </div>
        {q && (
          <div className="flex items-baseline gap-3">
            <span className="num text-2xl font-bold text-terminal-bright">
              {fmtNumber(q.price, 2)}
            </span>
            <ChangePill change={q.change} changePercent={q.changePercent} showAbs size="md" />
            <span className="text-[10px] text-terminal-muted">
              {q.delayed ? `Delayed ${q.delayMinutes}m` : "Live"} · {fmtTime(q.timestamp)}
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <DemoBadge isMock={bars.data?.isMock ?? true} />
          {user && (
            <button
              onClick={() => toggleWatch(symbol)}
              className={watched ? "t-btn-gold" : "t-btn"}
            >
              {watched ? "★ Watching" : "☆ Watch"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* chart */}
        <div className="lg:col-span-2">
          <Panel
            title="Price"
            actions={
              <div className="flex items-center gap-3">
                {/* indicators */}
                <div className="hidden items-center gap-1 sm:flex">
                  {SMA_OPTIONS.map((p) => {
                    const on = smas.includes(p);
                    const capped = on && !activeSmas.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => toggleSma(p)}
                        title={capped ? "Upgrade for more indicators" : `SMA ${p}`}
                        className={`rounded px-1.5 py-1 text-[10px] font-semibold ${
                          capped
                            ? "bg-terminal-warn/10 text-terminal-warn"
                            : on
                              ? "bg-terminal-accent/20 text-terminal-bright"
                              : "text-terminal-muted hover:text-terminal-text"
                        }`}
                      >
                        SMA{p}
                      </button>
                    );
                  })}
                </div>
                {/* timeframe */}
                <div className="flex items-center gap-0.5 rounded bg-terminal-bg p-0.5">
                  {TIMEFRAMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTf(t.id)}
                      className={`rounded px-2 py-1 text-[10px] font-semibold ${
                        tf === t.id
                          ? "bg-terminal-accent/25 text-terminal-bright"
                          : "text-terminal-muted hover:text-terminal-text"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {bars.loading && !bars.data ? (
              <SkeletonRows rows={6} />
            ) : (
              <>
                <CandleChart
                  bars={bars.data?.bars ?? []}
                  intraday={tfMeta.intraday}
                  smaPeriods={activeSmas}
                  maxIndicators={features.maxIndicators}
                />
                {smas.length > features.maxIndicators && (
                  <p className="mt-1 text-[10px] text-terminal-warn">
                    Free plan shows {features.maxIndicators} indicator
                    {features.maxIndicators === 1 ? "" : "s"} —{" "}
                    <Link href="/markets/upgrade" className="underline">
                      upgrade
                    </Link>{" "}
                    for up to 6.
                  </p>
                )}
              </>
            )}
          </Panel>
        </div>

        {/* key stats */}
        <div className="space-y-3">
          <Panel title="Key Statistics">
            {fund.loading && !fund.data ? (
              <SkeletonRows rows={4} />
            ) : fund.data ? (
              <div className="grid grid-cols-2 gap-2">
                <KpiCard label="P / E" value={fmtNumber(fund.data.fundamentals.peRatio, 1)} />
                <KpiCard
                  label="Div Yield"
                  value={`${fmtNumber(fund.data.fundamentals.dividendYield, 1)}%`}
                />
                <KpiCard
                  label="Market Cap"
                  value={fmtMarketCap(fund.data.fundamentals.marketCap)}
                />
                <KpiCard
                  label="52W Range"
                  value={
                    <span className="text-xs">
                      {fmtNumber(fund.data.fundamentals.week52Low, 2)}–
                      {fmtNumber(fund.data.fundamentals.week52High, 2)}
                    </span>
                  }
                />
              </div>
            ) : null}
          </Panel>

          {/* deep fundamentals (premium) */}
          <Panel title="Deeper Fundamentals">
            {!features.deepFundamentals ? (
              <UpgradeCTA feature="Deeper fundamentals">
                EPS, beta, book value and more with Premium.
              </UpgradeCTA>
            ) : fund.data ? (
              <div className="grid grid-cols-2 gap-2">
                <KpiCard label="EPS" value={fmtNumber(fund.data.fundamentals.eps, 2)} />
                <KpiCard label="Beta" value={fmtNumber(fund.data.fundamentals.beta, 2)} />
                <KpiCard
                  label="Book Value"
                  value={fmtNumber(fund.data.fundamentals.bookValue, 2)}
                />
                <KpiCard label="Volume" value={q ? fmtCompact(q.volume) : "—"} />
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AlertForm symbol={symbol.toUpperCase()} price={q?.price ?? 0} />
        <NewsFeed symbol={symbol.toUpperCase()} />
      </div>
    </div>
  );
}
