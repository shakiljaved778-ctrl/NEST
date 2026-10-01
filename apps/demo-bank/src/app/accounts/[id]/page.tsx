import { Badge, buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@amil/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { Statement } from "@/components/statement";
import { currentLocale } from "@/i18n/request";
import { actHref } from "@/lib/actions";
import { accountOf, currentCustomer, standingOrdersOf, statementLines } from "@/lib/bank";
import { date, money, num } from "@/lib/format";

export default async function AccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const a = accountOf(customer, id);
  const [orders, lines] = await Promise.all([
    standingOrdersOf(a.id),
    statementLines({ accountId: a.id }),
  ]);
  return (
    <AppShell title={a.productName} back="/" path={`/accounts/${id}`}>
      <Card className="bg-brand text-brand-contrast">
        <CardContent className="space-y-1 pt-4">
          <p className="text-xs opacity-80">
            •••• {a.number.slice(-4)}{" "}
            {a.isSalaryAccount ? <Badge>{t("account.salary")}</Badge> : null}{" "}
            {a.variant === "islamic" ? <Badge tone="islamic">{t("home.islamic")}</Badge> : null}
          </p>
          <p className="text-2xl font-semibold">
            <bdi>{money(a.balance, locale)}</bdi>
          </p>
          <p className="text-xs opacity-80">
            {t("account.lastActivity")}: {date(a.lastActivityAt, locale)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("account.standingOrders")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-black/5 text-sm">
          {orders.length === 0 ? <p className="text-ink-muted">{t("account.none")}</p> : null}
          {orders.map((o) => (
            <div key={o.id} className="flex justify-between py-2">
              <span>
                {o.payee}
                <span className="block text-xs text-ink-muted">
                  {t("account.next", { date: date(o.nextRunAt, locale) })}
                </span>
              </span>
              <bdi>{money(o.amount, locale)}</bdi>
            </div>
          ))}
          {a.chequesOutstanding > 0 ? (
            <div className="flex justify-between py-2">
              <span className="text-ink-muted">{t("account.cheques")}</span>
              <bdi>{num(a.chequesOutstanding, locale)}</bdi>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Statement lines={lines} locale={locale} />
      <Link
        href={actHref("account.close", { accountId: a.id })}
        className={buttonVariants({ variant: "destructive", block: true })}
        data-testid="close-account"
      >
        {t("actions.closeAccount")}
      </Link>
    </AppShell>
  );
}
