import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { InsightPanel } from "@/components/insight-panel";
import { currentLocale } from "@/i18n/request";
import { mintWidgetToken, publicAmilUrl } from "@/lib/amil";
import { cardOf, currentCustomer } from "@/lib/bank";

/** Close-card flow: AMIL's pre-action check runs before the bank's own final confirm step. */
export default async function CloseCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const card = cardOf(customer, id);
  const token = await mintWidgetToken(customer.externalRef, locale);
  return (
    <AppShell title={t("close.title")} back={`/cards/${id}`} path={`/cards/${id}/close`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t("close.step")}
      </p>
      <p className="text-sm">{t("close.intro", { card: card.productName })}</p>
      <InsightPanel
        apiBase={publicAmilUrl()}
        token={token}
        action="card.close"
        customerRef={customer.externalRef}
        cardId={card.id}
        locale={locale}
        fallbackHref={`/cards/${id}/close/confirm`}
        fallbackLabel={t("close.continue")}
        fallbackNote={t("close.unavailable")}
      />
    </AppShell>
  );
}
