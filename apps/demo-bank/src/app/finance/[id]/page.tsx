import { Badge, buttonVariants, Card, CardContent } from "@amil/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { currentCustomer, financeOf } from "@/lib/bank";
import { actHref } from "@/lib/actions";
import { DEMO_AMOUNTS } from "@/lib/demo";
import { date, money, num } from "@/lib/format";

export default async function FinanceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const f = financeOf(customer, id);
  return (
    <AppShell title={f.productName} back="/" path={`/finance/${id}`}>
      <Card className="bg-brand text-brand-contrast">
        <CardContent className="space-y-1 pt-4">
          <p className="text-xs opacity-80">
            {t(`finance.${f.type}`)}{" "}
            {f.type !== "conventional" ? <Badge tone="islamic">{t("home.islamic")}</Badge> : null}
          </p>
          <p className="text-2xl font-semibold">
            <bdi>{money(f.principalOutstanding, locale)}</bdi>
          </p>
          <p className="text-xs opacity-80">
            {t("finance.tenor", {
              elapsed: num(f.monthsElapsed, locale),
              tenor: num(f.tenorMonths, locale),
            })}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="divide-y divide-black/5 pt-2 text-sm">
          <div className="flex justify-between py-2">
            <span className="text-ink-muted">{t("finance.instalment")}</span>
            <bdi>{money(f.instalment, locale)}</bdi>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-ink-muted">{t("finance.next")}</span>
            <bdi>{date(f.nextInstalmentAt, locale)}</bdi>
          </div>
        </CardContent>
      </Card>
      <Link
        href={actHref("finance.top_up", {
          financeId: f.id,
          amount: DEMO_AMOUNTS.topUp,
          months: DEMO_AMOUNTS.topUpMonths,
        })}
        className={buttonVariants({ variant: "outline", block: true })}
        data-testid="top-up"
      >
        {t("actions.topUp")}
      </Link>
      <Link
        href={`/finance/${id}/settle`}
        className={buttonVariants({ block: true })}
        data-testid="settle-early"
      >
        {t("finance.settle")}
      </Link>
    </AppShell>
  );
}
