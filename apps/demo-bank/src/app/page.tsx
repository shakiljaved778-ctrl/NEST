import { Badge, Card, CardContent, CardHeader, CardTitle } from "@amil/ui";
import { ChevronRight, CreditCard, Landmark, PiggyBank, Wallet } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { currentCustomer } from "@/lib/bank";
import { date, money, num } from "@/lib/format";

export default async function Home() {
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const name = locale === "ar" ? customer.displayNameAr : customer.displayName;
  const row = "flex items-center justify-between gap-3 py-2";
  return (
    <AppShell customerName={name} path="/">
      <Link
        href="/personas"
        className="block text-center text-xs text-brand underline"
        data-testid="switch-persona"
      >
        {t("app.switchPersona")}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet size={16} />
            {t("home.accounts")}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-black/5">
          {customer.accounts.map((a) => (
            <div key={a.id} className={row}>
              <div>
                <p className="text-sm">{a.productName}</p>
                <p className="text-xs text-ink-muted">
                  •••• {a.number.slice(-4)}{" "}
                  {a.variant === "islamic" ? (
                    <Badge tone="islamic">{t("home.islamic")}</Badge>
                  ) : null}
                </p>
              </div>
              <p className="text-sm font-semibold">
                <bdi>{money(a.balance, locale)}</bdi>
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard size={16} />
            {t("home.cards")}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-black/5">
          {customer.cards.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("home.none")}</p>
          ) : null}
          {customer.cards.map((c) => (
            <Link key={c.id} href={`/cards/${c.id}`} className={row} data-testid={`card-${c.id}`}>
              <div>
                <p className="text-sm">{c.productName}</p>
                <p className="text-xs text-ink-muted">
                  •••• {c.panLast4}
                  {c.rewards && c.rewards.balance > 0 ? (
                    <> · {t("home.points", { points: num(c.rewards.balance, locale) })}</>
                  ) : null}
                </p>
              </div>
              <span className="flex items-center gap-1 text-sm font-semibold">
                <bdi>{money(c.balance, locale)}</bdi>
                <ChevronRight size={14} className="rtl:rotate-180" />
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>

      {customer.finances.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark size={16} />
              {t("home.finance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-black/5">
            {customer.finances.map((f) => (
              <Link
                key={f.id}
                href={`/finance/${f.id}`}
                className={row}
                data-testid={`finance-${f.id}`}
              >
                <div>
                  <p className="text-sm">{f.productName}</p>
                  <p className="text-xs text-ink-muted">
                    {t("home.instalment", { amount: money(f.instalment, locale) })}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <bdi>{money(f.principalOutstanding, locale)}</bdi>
                  <ChevronRight size={14} className="rtl:rotate-180" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {customer.deposits.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank size={16} />
              {t("home.deposits")}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-black/5">
            {customer.deposits.map((d) => (
              <div key={d.id} className={row}>
                <div>
                  <p className="text-sm">{d.productName}</p>
                  <p className="text-xs text-ink-muted">
                    {t("home.matures", { date: date(d.maturityAt, locale) })}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  <bdi>{money(d.principal, locale)}</bdi>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}
