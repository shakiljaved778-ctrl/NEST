"use client";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/market/providers/AppState";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { Panel } from "@/components/market/ui/Panel";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { SkeletonRows } from "@/components/market/ui/Skeleton";
import { getInstrument } from "@/lib/market/instruments";
import { fmtNumber } from "@/lib/market/format";

export function WatchlistPanel() {
  const { plan, watchlist, toggleWatch, user } = useAppState();
  const router = useRouter();
  const symbols = watchlist.length ? watchlist : ["QSE"];
  const { data, loading } = useAsync(
    () => marketApi.quotes(symbols, plan),
    [plan, symbols.join(",")],
    { refetchInterval: plan === "premium" ? 5000 : 30000 },
  );

  return (
    <Panel
      title="Watchlist"
      subtitle={user ? undefined : "Sign in to customize"}
      bodyClassName="p-1.5"
    >
      {loading && !data ? (
        <SkeletonRows rows={4} />
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {symbols.map((sym) => {
              const q = data?.quotes[sym];
              const inst = getInstrument(sym);
              return (
                <tr
                  key={sym}
                  className="group border-t border-terminal-border/60 first:border-t-0 hover:bg-terminal-panel2"
                >
                  <td
                    className="cursor-pointer px-2 py-1.5"
                    onClick={() => router.push(`/markets/symbol/${sym}`)}
                  >
                    <div className="font-bold text-terminal-bright">{sym}</div>
                    <div className="truncate text-[10px] text-terminal-muted">
                      {inst?.name ?? sym}
                    </div>
                  </td>
                  <td className="num px-2 py-1.5 text-right text-terminal-text">
                    {q ? fmtNumber(q.price, 2) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {q && <ChangePill changePercent={q.changePercent} size="xs" />}
                  </td>
                  <td className="w-6 px-1 text-right">
                    {user && (
                      <button
                        title="Remove from watchlist"
                        onClick={() => toggleWatch(sym)}
                        className="text-terminal-muted opacity-0 transition group-hover:opacity-100 hover:text-terminal-down"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
