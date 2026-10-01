import { Card, CardContent } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { cardOf, currentCustomer } from "@/lib/bank";
import { money, num } from "@/lib/format";

export default async function Instalments({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const card = cardOf(customer, id);
  return (
    <AppShell
      title={t("instalments.title")}
      back={`/cards/${id}`}
      path={`/cards/${id}/instalments`}
    >
      {card.instalmentPlans.map((p) => (
        <Card key={p.id} data-testid="instalments-screen">
          <CardContent className="space-y-1 pt-4 text-sm">
            <p className="font-medium">{p.description}</p>
            <p className="text-ink-muted">
              {t("instalments.monthly", { amount: money(p.monthlyAmount, locale) })} ·{" "}
              {t("instalments.months", { months: num(p.monthsRemaining, locale) })}
            </p>
            <p>
              <bdi>{money(p.principalRemaining, locale)}</bdi>
            </p>
          </CardContent>
        </Card>
      ))}
    </AppShell>
  );
}
