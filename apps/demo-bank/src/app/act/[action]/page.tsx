import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { InsightPanel } from "@/components/insight-panel";
import { currentLocale } from "@/i18n/request";
import { ACTIONS, contextFromQuery, isAction } from "@/lib/actions";
import { mintWidgetToken, publicAmilUrl } from "@/lib/amil";
import { currentCustomer } from "@/lib/bank";
import { money, num } from "@/lib/format";

/**
 * One flow for every action AMIL checks: the AMIL card first, then the bank's own confirmation.
 * The product in the query is the customer's own: AMIL verifies it again server-side.
 */
export default async function ActionFlow({
  params,
  searchParams,
}: {
  params: Promise<{ action: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ action }, query, customer, t, locale] = await Promise.all([
    params,
    searchParams,
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  if (!isAction(action)) notFound();
  const context = contextFromQuery(query);
  const key = action.replace(".", "_");
  const token = await mintWidgetToken(customer.externalRef, locale);
  const self = `/act/${action}?${new URLSearchParams(query as Record<string, string>).toString()}`;
  return (
    <AppShell title={t(`act.titles.${key}`)} back={ACTIONS[action].back(context)} path={self}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t("act.step")}
      </p>
      <p className="text-sm" data-testid="act-intro">
        {t(`act.intros.${key}`, {
          amount: context.amount ? money(context.amount, locale) : "",
          months: context.months ? num(context.months, locale) : "",
        })}
      </p>
      <InsightPanel
        apiBase={publicAmilUrl()}
        token={token}
        action={action}
        customerRef={customer.externalRef}
        context={context}
        locale={locale}
        fallbackHref={ACTIONS[action].confirm(context)}
        fallbackLabel={t("act.continue")}
        fallbackNote={t("act.unavailable")}
      />
    </AppShell>
  );
}
