"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/market/providers/AppState";
import { useSearch } from "./SearchCommand";
import { MacroStrip } from "./MacroStrip";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { Sparkline } from "@/components/market/charts/Sparkline";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { PlanBadge } from "@/components/market/ui/PlanBadge";
import { DemoBadge } from "@/components/market/ui/DemoBadge";
import { fmtNumber } from "@/lib/market/format";

export function TopBar() {
  const { user, plan, setPlan, logOut } = useAppState();
  const search = useSearch();
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  const qe = useAsync(() => marketApi.bars("QSE", "1d", plan), [plan], {
    refetchInterval: plan === "premium" ? 5000 : 30000,
  });
  const spark = qe.data?.bars.slice(-40).map((b) => b.close) ?? [];
  const q = qe.data?.quote;

  return (
    <header className="border-b border-terminal-border bg-terminal-panel">
      {/* row 1 — brand, QE ticker, search, account */}
      <div className="flex items-center gap-4 px-4 py-2">
        <Link href="/markets" className="flex shrink-0 items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded bg-terminal-qatar text-[11px] font-bold text-white">
            QM
          </span>
          <span className="hidden text-sm font-bold tracking-tight text-terminal-bright sm:inline">
            Qatar Markets
          </span>
        </Link>

        {/* QE index ticker + mini chart */}
        <Link
          href="/markets/symbol/QSE"
          className="flex shrink-0 items-center gap-2 rounded-md border border-terminal-border bg-terminal-bg px-2.5 py-1"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-terminal-muted">
            QE Index
          </span>
          {q ? (
            <>
              <span className="num text-sm font-semibold text-terminal-bright">
                {fmtNumber(q.price, 2)}
              </span>
              <ChangePill change={q.change} changePercent={q.changePercent} size="xs" />
              <span className="hidden sm:block">
                <Sparkline values={spark} width={64} height={20} up={q.changePercent >= 0} />
              </span>
            </>
          ) : (
            <span className="text-xs text-terminal-muted">loading…</span>
          )}
        </Link>

        {/* search */}
        <button
          onClick={search.open}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-md border border-terminal-border bg-terminal-bg px-3 py-1.5 text-left text-xs text-terminal-muted hover:border-terminal-borderLight"
        >
          <span>⌕</span>
          <span className="truncate">Search symbols &amp; macro…</span>
          <span className="kbd ml-auto hidden sm:inline-flex">/</span>
        </button>

        <DemoBadge isMock={qe.data?.isMock ?? true} className="hidden lg:inline-flex" />

        {/* account */}
        {user ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenu((m) => !m)}
              className="flex items-center gap-2 rounded-md border border-terminal-border bg-terminal-bg px-2.5 py-1.5 text-xs"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-terminal-accent/25 text-[10px] font-bold text-terminal-bright">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-24 truncate text-terminal-text md:inline">
                {user.name}
              </span>
              <PlanBadge plan={plan} />
            </button>
            {menu && (
              <div
                className="absolute right-0 z-40 mt-1 w-56 t-panel p-1 text-xs"
                onMouseLeave={() => setMenu(false)}
              >
                <div className="px-3 py-2 text-terminal-muted">
                  Signed in as
                  <div className="truncate text-terminal-text">{user.email}</div>
                </div>
                <div className="my-1 border-t border-terminal-border" />
                {/* Demo-only plan toggle for testing freemium gating. */}
                <div className="px-3 py-1.5">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-terminal-muted">
                    Demo plan toggle
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPlan("free")}
                      className={`flex-1 rounded px-2 py-1 ${plan === "free" ? "bg-terminal-accent/20 text-terminal-bright" : "bg-terminal-panel2 text-terminal-muted"}`}
                    >
                      Free
                    </button>
                    <button
                      onClick={() => setPlan("premium")}
                      className={`flex-1 rounded px-2 py-1 ${plan === "premium" ? "bg-terminal-warn/20 text-terminal-warn" : "bg-terminal-panel2 text-terminal-muted"}`}
                    >
                      Premium
                    </button>
                  </div>
                </div>
                <div className="my-1 border-t border-terminal-border" />
                <Link href="/markets/upgrade" className="block rounded px-3 py-2 hover:bg-terminal-panel2">
                  ★ Manage subscription
                </Link>
                <button
                  onClick={() => {
                    logOut();
                    setMenu(false);
                    router.push("/markets/login");
                  }}
                  className="block w-full rounded px-3 py-2 text-left text-terminal-down hover:bg-terminal-panel2"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/markets/login" className="t-btn-accent shrink-0">
            Sign in
          </Link>
        )}
      </div>

      {/* row 2 — macro strip */}
      <div className="border-t border-terminal-border px-4 py-1.5">
        <MacroStrip />
      </div>
    </header>
  );
}
