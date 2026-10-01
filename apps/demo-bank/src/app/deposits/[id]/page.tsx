import { Badge, buttonVariants, Card, CardContent } from "@amil/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { actHref } from "@/lib/actions";
import { currentCustomer, depositOf } from "@/lib/bank";
import { date, money } from "@/lib/format";

export default async function DepositDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const d = depositOf(customer, id);
  const rows: [string, string][] = [
    [t("deposit.rate"), `${d.ratePct.toFixed(2)}%`],
    [t("deposit.started"), date(d.startAt, locale)],
    [t("deposit.matures"), date(d.maturityAt, locale)],
    [t("deposit.autoRenew"), d.autoRenew ? t("deposit.yes") : t("deposit.no")],
  ];
  return (
    <AppShell title={d.productName} back="/" path={`/deposits/${id}`}>
      <Card className="bg-brand text-brand-contrast">
        <CardContent className="space-y-1 pt-4">
          <p className="text-xs opacity-80">
            {t("deposit.principal")}{" "}
            {d.variant === "islamic" ? <Badge tone="islamic">{t("home.islamic")}</Badge> : null}
          </p>
          <p className="text-2xl font-semibold">
            <bdi>{money(d.principal, locale)}</bdi>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="divide-y divide-black/5 pt-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 text-sm">
              <span className="text-ink-muted">{k}</span>
              <bdi className="font-medium">{v}</bdi>
            </div>
          ))}
        </CardContent>
      </Card>
      <Link
        href={`/compare/deposit?depositId=${d.id}`}
        className={buttonVariants({ variant: "outline", block: true })}
        data-testid="compare-deposit"
      >
        {t("compare.deposit")}
      </Link>
      <Link
        href={actHref("deposit.break", { depositId: d.id })}
        className={buttonVariants({ variant: "destructive", block: true })}
        data-testid="break-deposit"
      >
        {t("actions.breakDeposit")}
      </Link>
    </AppShell>
  );
}
