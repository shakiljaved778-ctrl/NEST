import { Card, CardContent, CardHeader, CardTitle } from "@amil/ui";
import { ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { StatementLine } from "@/lib/bank";
import { date, money } from "@/lib/format";

/** Statement lines. Fee lines are tappable: they open the AMIL charge explanation. */
export async function Statement({
  lines,
  locale,
}: {
  lines: StatementLine[];
  locale: "en" | "ar";
}) {
  const t = await getTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("statement.recent")}</CardTitle>
        <p className="text-xs text-ink-muted">{t("statement.feeHint")}</p>
      </CardHeader>
      <CardContent className="divide-y divide-black/5" data-testid="statement">
        {lines.map((l) => {
          const amount = (
            <bdi className={l.direction === "credit" ? "text-emerald-700" : ""}>
              {l.direction === "credit" ? "+" : "−"}
              {money(l.amount, locale)}
            </bdi>
          );
          const label = (
            <div className="min-w-0">
              <p className="truncate text-sm">{l.merchant}</p>
              <p className="text-xs text-ink-muted">
                {date(l.postedAt, locale)}
                {l.feeCode ? <> · {t("statement.fee")}</> : null}
              </p>
            </div>
          );
          return l.feeCode ? (
            <Link
              key={l.id}
              href={`/charges/${l.id}`}
              className="flex items-center justify-between gap-3 py-2"
              data-testid={`fee-${l.feeCode}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Info size={14} className="shrink-0 text-brand" aria-hidden />
                {label}
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold">
                {amount}
                <ChevronRight size={14} className="rtl:rotate-180" />
              </span>
            </Link>
          ) : (
            <div key={l.id} className="flex items-center justify-between gap-3 py-2">
              {label}
              <span className="text-sm">{amount}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
