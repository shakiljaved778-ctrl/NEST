"use client";
import { useRouter } from "next/navigation";
import type { MarketMover } from "@/types/market";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { fmtNumber, fmtCompact } from "@/lib/market/format";

/** Compact table of market movers; click a row → symbol detail. */
export function MoversTable({ rows }: { rows: MarketMover[] }) {
  const router = useRouter();
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-terminal-muted">
          <th className="px-2 py-1 text-left font-semibold">Symbol</th>
          <th className="px-2 py-1 text-right font-semibold">Last</th>
          <th className="px-2 py-1 text-right font-semibold">Chg%</th>
          <th className="hidden px-2 py-1 text-right font-semibold sm:table-cell">Vol</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.symbol}
            onClick={() => router.push(`/markets/symbol/${r.symbol}`)}
            className="cursor-pointer border-t border-terminal-border/60 hover:bg-terminal-panel2"
          >
            <td className="px-2 py-1.5">
              <div className="font-bold text-terminal-bright">{r.symbol}</div>
              <div className="truncate text-[10px] text-terminal-muted">{r.name}</div>
            </td>
            <td className="num px-2 py-1.5 text-right text-terminal-text">
              {fmtNumber(r.price, 2)}
            </td>
            <td className="px-2 py-1.5 text-right">
              <ChangePill changePercent={r.changePercent} size="xs" />
            </td>
            <td className="num hidden px-2 py-1.5 text-right text-terminal-muted sm:table-cell">
              {fmtCompact(r.volume)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
