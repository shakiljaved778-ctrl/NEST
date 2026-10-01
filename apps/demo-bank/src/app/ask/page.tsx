import { Card, CardContent } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { AssistantPanel } from "@/components/assistant-panel";
import { currentLocale } from "@/i18n/request";
import { mintWidgetToken, publicAmilUrl } from "@/lib/amil";
import { currentCustomer } from "@/lib/bank";

/** Ask AMIL: questions about the customer's own products, answered from computed facts. */
export default async function Ask() {
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const token = await mintWidgetToken(customer.externalRef, locale);
  return (
    <AppShell title={t("ask.title")} path="/ask">
      {token ? (
        <AssistantPanel
          apiBase={publicAmilUrl()}
          token={token}
          customerRef={customer.externalRef}
          locale={locale}
        />
      ) : (
        <Card>
          <CardContent className="pt-4 text-sm text-ink-muted">{t("ask.unavailable")}</CardContent>
        </Card>
      )}
    </AppShell>
  );
}
