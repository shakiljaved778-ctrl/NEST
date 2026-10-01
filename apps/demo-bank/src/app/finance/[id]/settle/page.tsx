import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { InsightPanel } from "@/components/insight-panel";
import { currentLocale } from "@/i18n/request";
import { mintWidgetToken, publicAmilUrl } from "@/lib/amil";
import { currentCustomer, financeOf } from "@/lib/bank";

/** Early-settlement flow: AMIL's check runs before the bank's own settlement confirmation. */
export default async function Settle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const finance = financeOf(customer, id);
  const token = await mintWidgetToken(customer.externalRef, locale);
  return (
    <AppShell title={t("settle.title")} back={`/finance/${id}`} path={`/finance/${id}/settle`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t("settle.step")}
      </p>
      <p className="text-sm">{t("settle.intro")}</p>
      <InsightPanel
        apiBase={publicAmilUrl()}
        token={token}
        action="finance.early_settlement"
        customerRef={customer.externalRef}
        financeId={finance.id}
        locale={locale}
        fallbackHref={`/finance/${id}/settle/confirm`}
        fallbackLabel={t("settle.continue")}
        fallbackNote={t("close.unavailable")}
      />
    </AppShell>
  );
}
