"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useAppState } from "@/components/market/providers/AppState";
import { MarketOverviewPanel } from "@/components/market/panels/MarketOverviewPanel";
import { WatchlistPanel } from "@/components/market/panels/WatchlistPanel";
import { GccComparison } from "@/components/market/panels/GccComparison";
import { MacroChartCard } from "@/components/market/panels/MacroChartCard";
import { PortfolioSummaryPanel } from "@/components/market/panels/PortfolioSummaryPanel";

export default function DashboardHome() {
  const { user, track } = useAppState();
  useEffect(() => track("view_dashboard"), [track]);

  return (
    <div className="space-y-3">
      {/* onboarding / sign-in nudge */}
      {!user ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-terminal-accent/30 bg-terminal-accent/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-terminal-bright">
              Welcome to the Qatar Market Dashboard
            </p>
            <p className="text-xs text-terminal-muted">
              Sign in to build a watchlist, track a portfolio, and tailor the dashboard to
              your goals. All data is simulated demo data.
            </p>
          </div>
          <Link href="/markets/login" className="t-btn-accent">
            Sign in / Create account
          </Link>
        </div>
      ) : (
        !user.profile?.completedOnboarding && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-terminal-warn/30 bg-terminal-warn/10 px-4 py-3">
            <p className="min-w-0 flex-1 text-xs text-terminal-text">
              Finish setting up your investor profile to tailor your default widgets.
            </p>
            <Link href="/markets/onboarding" className="t-btn-gold">
              Complete profile
            </Link>
          </div>
        )
      )}

      <MarketOverviewPanel />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <WatchlistPanel />
        </div>
        <div className="lg:col-span-2">
          <PortfolioSummaryPanel />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <GccComparison />
        <div className="grid gap-3">
          <MacroChartCard seriesId="qcb_policy_rate" height={150} />
          <MacroChartCard seriesId="qatar_cpi_yoy" height={150} />
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/markets/macro"
          className="text-xs text-terminal-accent hover:underline"
        >
          View full macro dashboard →
        </Link>
      </div>
    </div>
  );
}
