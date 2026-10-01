import { Badge, buttonVariants, Card, CardContent } from "@amil/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { cardOf, currentCustomer, largestRecentPurchase } from "@/lib/bank";
import { actHref } from "@/lib/actions";
import { DEMO_AMOUNTS } from "@/lib/demo";
import { money, num } from "@/lib/format";

export default async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const card = cardOf(customer, id);
  const rows: [string, string][] = [
    [t("card.balance"), money(card.balance, locale)],
    [t("card.statement"), money(card.statementBalance, locale)],
    [t("card.minDue"), money(card.minDue, locale)],
    [t("card.limit"), money(card.creditLimit, locale)],
    [t("card.annualFee"), money(card.annualFee, locale)],
    [t("card.supplementary"), num(card.supplementaryCount, locale)],
  ];
  const purchase = await largestRecentPurchase(card.id);
  if (card.rewards) rows.splice(1, 0, [t("card.points"), num(card.rewards.balance, locale)]);
  return (
    <AppShell title={card.productName} back="/" path={`/cards/${id}`}>
      <Card className="bg-brand text-brand-contrast">
        <CardContent className="space-y-1 pt-4">
          <p className="text-xs opacity-80">
            •••• •••• •••• {card.panLast4}{" "}
            {card.type === "islamic" ? <Badge tone="islamic">{t("home.islamic")}</Badge> : null}
          </p>
          <p className="text-2xl font-semibold">
            <bdi>{money(card.balance, locale)}</bdi>
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
      {card.instalmentPlans.length > 0 ? (
        <Link
          href={`/cards/${id}/instalments`}
          className={buttonVariants({ variant: "outline", block: true })}
        >
          {t("card.instalments")}
        </Link>
      ) : null}
      <div className="grid grid-cols-2 gap-2" data-testid="card-actions">
        <Link
          href={actHref("card.minimum_payment", { cardId: card.id })}
          className={buttonVariants({ variant: "outline" })}
          data-testid="action-pay"
        >
          {t("actions.pay")}
        </Link>
        <Link
          href={`/compare/payment?cardId=${card.id}`}
          className={`${buttonVariants({ variant: "outline" })} col-span-2`}
          data-testid="action-compare-payments"
        >
          {t("compare.payment")}
        </Link>
        <Link
          href={`/cards/${id}/statement`}
          className={buttonVariants({ variant: "outline" })}
          data-testid="action-statement"
        >
          {t("actions.statement")}
        </Link>
        <Link
          href={actHref("card.cash_withdrawal", {
            cardId: card.id,
            amount: DEMO_AMOUNTS.cashWithdrawal,
          })}
          className={buttonVariants({ variant: "outline" })}
          data-testid="action-withdraw"
        >
          {t("actions.withdraw")}
        </Link>
        <Link
          href={actHref("card.balance_transfer", {
            cardId: card.id,
            amount: DEMO_AMOUNTS.balanceTransfer,
          })}
          className={buttonVariants({ variant: "outline" })}
          data-testid="action-transfer"
        >
          {t("actions.transfer")}
        </Link>
        {purchase ? (
          <Link
            href={actHref("card.epp_conversion", {
              cardId: card.id,
              transactionId: purchase.id,
              months: DEMO_AMOUNTS.eppMonths,
            })}
            className={`${buttonVariants({ variant: "outline" })} col-span-2`}
            data-testid="action-convert"
          >
            {t("actions.convert")}
          </Link>
        ) : null}
      </div>
      <Link
        href={actHref("card.close", { cardId: card.id })}
        className={buttonVariants({ variant: "destructive", block: true })}
        data-testid="close-card"
      >
        {t("card.close")}
      </Link>
    </AppShell>
  );
}
