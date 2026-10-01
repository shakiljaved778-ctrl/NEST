import { Button, Card, CardContent } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { cardOf, currentCustomer } from "@/lib/bank";
import { money, num } from "@/lib/format";

/** Deep-link target of "Redeem points first" (ddb://cards/{id}/rewards). */
export default async function Rewards({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const card = cardOf(customer, id);
  const points = card.rewards?.balance ?? 0;
  const value = card.rewards ? card.rewards.pointValueQar.times(points) : null;
  return (
    <AppShell title={t("rewards.title")} back={`/cards/${id}`} path={`/cards/${id}/rewards`}>
      <Card>
        <CardContent className="space-y-3 pt-4" data-testid="rewards-screen">
          <p className="text-sm">
            {t("rewards.body", {
              points: num(points, locale),
              value: value ? money(value, locale) : money("0.00", locale),
            })}
          </p>
          <Button block disabled>
            {t("rewards.redeem")}
          </Button>
          <p className="text-xs text-ink-muted">{t("rewards.note")}</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
