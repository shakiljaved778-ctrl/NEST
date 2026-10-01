import type { ChargeExplanation } from "@amil/sdk";
import { buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@amil/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { amilServer } from "@/lib/amil";
import { currentCustomer, transactionOf } from "@/lib/bank";
import { date } from "@/lib/format";

/**
 * Explain my charge. The bank backend asks AMIL (HMAC, server-side) why a fee line is what it is;
 * AMIL answers from the published fee schedule and the customer's own transactions.
 */
export default async function ChargeScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const txn = await transactionOf(customer, id);
  const back = txn.cardId ? `/cards/${txn.cardId}/statement` : `/accounts/${txn.accountId}`;
  let x: ChargeExplanation | null = null;
  try {
    x = await amilServer().explainCharge({
      customerRef: customer.externalRef,
      transactionId: id,
      locale,
    });
  } catch (error) {
    console.error(
      "AMIL explain-charge unavailable",
      error instanceof Error ? error.message : error,
    );
  }
  return (
    <AppShell title={t("charge.title")} back={back} path={`/charges/${id}`}>
      {!x ? (
        <Card>
          <CardContent className="pt-4 text-sm text-ink-muted">
            {t("charge.unavailable")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="charge-explanation" data-kind={x.kind}>
          <Card>
            <CardContent className="space-y-2 pt-4">
              {x.name ? <p className="text-base font-semibold">{x.name}</p> : null}
              {x.amount ? (
                <p className="text-2xl font-semibold" data-testid="charge-amount">
                  <bdi>{x.amount.display}</bdi>
                </p>
              ) : null}
              <p className="text-xs text-ink-muted">
                {txn.merchant} · {date(txn.postedAt, locale)}
              </p>
              {x.description ? <p className="text-sm">{x.description}</p> : null}
            </CardContent>
          </Card>
          {x.calculation && x.calculation.lines.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("charge.calculation")}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-black/5 text-sm" data-testid="charge-lines">
                {x.calculation.lines.map((l) => (
                  <div key={l.label} className="flex justify-between gap-3 py-2">
                    <span className="text-ink-muted">{l.label}</span>
                    <bdi className="text-end font-medium">{l.display}</bdi>
                  </div>
                ))}
                <p className="pt-2 text-xs" data-testid="charge-match">
                  {x.calculation.matches === true
                    ? t("charge.matches")
                    : x.calculation.matches === false
                      ? t("charge.noMatch")
                      : t("charge.notRecomputable")}
                </p>
              </CardContent>
            </Card>
          ) : null}
          {x.avoidTip ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("charge.avoid")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{x.avoidTip}</CardContent>
            </Card>
          ) : null}
          <p className="text-xs text-ink-muted" data-testid="charge-disclosure">
            {x.disclosure}
          </p>
        </div>
      )}
      <Link
        href={`/support/callback?topic=explain.charge`}
        className={buttonVariants({ variant: "outline", block: true })}
      >
        {t("charge.talk")}
      </Link>
    </AppShell>
  );
}
