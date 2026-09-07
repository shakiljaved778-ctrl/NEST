"use client";
import Link from "next/link";
import { useAppState } from "@/components/market/providers/AppState";
import { marketApi } from "@/lib/market/api";
import { useAsync } from "@/lib/market/useAsync";
import { ChangePill } from "@/components/market/ui/ChangePill";
import { fmtNumber } from "@/lib/market/format";

/** Quick macro strip: Brent, USD/QAR, QCB policy rate, US 10Y. */
export function MacroStrip() {
  const { plan } = useAppState();
  const global = useAsync(() => marketApi.global(plan), [plan], {
    refetchInterval: plan === "premium" ? 5000 : 30000,
  });
  const rate = useAsync(() => marketApi.macro("qcb_policy_rate"), []);

  const tile = (sym: string) => global.data?.tiles.find((t) => t.symbol === sym);
  const brent = tile("BRENT");
  const usdqar = tile("USDQAR");
  const us10y = tile("US10Y");
  const policy = rate.data?.series.dataPoints.at(-1)?.value;

  return (
    <div className="flex items-center gap-4 overflow-x-auto t-scroll text-xs">
      <StripItem
        href="/markets/symbol/BRENT"
        label="Brent"
        value={brent ? `$${fmtNumber(brent.quote.price, 2)}` : "—"}
        pct={brent?.quote.changePercent}
      />
      <StripItem
        href="/markets/symbol/USDQAR"
        label="USD/QAR"
        value={usdqar ? fmtNumber(usdqar.quote.price, 4) : "—"}
        pct={usdqar?.quote.changePercent}
      />
      <StripItem
        href="/markets/macro"
        label="QCB Rate"
        value={policy !== undefined ? `${fmtNumber(policy, 2)}%` : "—"}
      />
      <StripItem
        href="/markets/symbol/US10Y"
        label="US 10Y"
        value={us10y ? `${fmtNumber(us10y.quote.price, 2)}%` : "—"}
        pct={us10y?.quote.changePercent}
      />
    </div>
  );
}

function StripItem({
  href,
  label,
  value,
  pct,
}: {
  href: string;
  label: string;
  value: string;
  pct?: number;
}) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-2 whitespace-nowrap hover:opacity-80"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
        {label}
      </span>
      <span className="num font-semibold text-terminal-bright">{value}</span>
      {pct !== undefined && <ChangePill changePercent={pct} size="xs" />}
    </Link>
  );
}
