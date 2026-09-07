"use client";
import { Panel } from "@/components/market/ui/Panel";
import { getInstrument } from "@/lib/market/instruments";

/** Static, clearly-labeled placeholder news feed (no live source in v1). */
export function NewsFeed({ symbol }: { symbol: string }) {
  const name = getInstrument(symbol)?.name ?? symbol;
  const items = [
    { time: "09:12", tag: "Earnings", text: `${name} reports quarterly results in line with estimates` },
    { time: "08:40", tag: "QSE", text: "Qatar Stock Exchange trading volumes steady in early session" },
    { time: "Yesterday", tag: "Macro", text: "QCB holds reference rates; watching Fed trajectory" },
    { time: "Yesterday", tag: "Sector", text: `Analysts maintain neutral stance on ${getInstrument(symbol)?.sector ?? "sector"}` },
  ];
  return (
    <Panel
      title="News"
      actions={
        <span className="t-chip border border-terminal-warn/40 bg-terminal-warn/10 text-terminal-warn">
          Demo
        </span>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-terminal-border/60">
        {items.map((n, i) => (
          <li key={i} className="px-3 py-2">
            <div className="flex items-center gap-2 text-[10px] text-terminal-muted">
              <span className="t-chip bg-terminal-panel2">{n.tag}</span>
              <span className="num">{n.time}</span>
            </div>
            <p className="mt-1 text-xs text-terminal-text">{n.text}</p>
          </li>
        ))}
      </ul>
      <p className="px-3 py-2 text-[10px] text-terminal-muted">
        Placeholder headlines — a live news provider will populate this feed.
      </p>
    </Panel>
  );
}
