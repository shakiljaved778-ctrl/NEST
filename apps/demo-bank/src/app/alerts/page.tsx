import type { AlertList } from "@amil/sdk";
import { Badge, Card, CardContent } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { AlertCard } from "@/components/alert-card";
import { currentLocale } from "@/i18n/request";
import { amilServer, mintWidgetToken, publicAmilUrl } from "@/lib/amil";
import { currentCustomer } from "@/lib/bank";
import { date } from "@/lib/format";

/**
 * Alerts inbox. AMIL's scheduled runs (rewards expiry, account dormancy) write the alerts; the
 * bank backend lists them over HMAC and marks the ones shown as read.
 */
export default async function Alerts() {
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  let list: AlertList | null = null;
  const amil = amilServer();
  try {
    list = await amil.listAlerts(customer.externalRef, locale);
  } catch (error) {
    console.error("AMIL alerts unavailable", error instanceof Error ? error.message : error);
  }
  const consented = customer.id ? await proactiveConsent(customer.externalRef) : false;
  const token =
    list && list.alerts.length > 0 ? await mintWidgetToken(customer.externalRef, locale) : null;
  // Shown now: mark as read (best effort; the "New" badge reflects the state before this visit).
  if (list)
    await Promise.allSettled(
      list.alerts.filter((a) => !a.readAt).map((a) => amil.markAlertRead(a.id)),
    );

  return (
    <AppShell title={t("alerts.title")} path="/alerts">
      {!list ? (
        <Card>
          <CardContent className="pt-4 text-sm text-ink-muted">
            {t("alerts.unavailable")}
          </CardContent>
        </Card>
      ) : list.alerts.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-ink-muted" data-testid="alerts-empty">
            {consented ? t("alerts.empty") : t("alerts.consentOff")}
          </CardContent>
        </Card>
      ) : (
        list.alerts.map((a) => (
          <section key={a.id} className="space-y-1" data-testid={`alert-${a.rulePackKey}`}>
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              {date(new Date(a.createdAt), locale)}
              {a.readAt ? null : <Badge>{t("alerts.new")}</Badge>}
            </p>
            <AlertCard
              apiBase={publicAmilUrl()}
              token={token}
              insight={a.insight}
              locale={locale}
            />
          </section>
        ))
      )}
    </AppShell>
  );
}

async function proactiveConsent(customerRef: string): Promise<boolean> {
  try {
    const { consents } = await amilServer().listConsents(customerRef);
    return consents.some((c) => c.purpose === "proactive_alerts" && !c.withdrawnAt);
  } catch {
    return false;
  }
}
