import Link from "next/link";
import { actHref } from "@/lib/actions";
import { Button, buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { setInsightsConsent, setLocale } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { amilServer } from "@/lib/amil";
import { currentCustomer } from "@/lib/bank";

export default async function Settings() {
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  let consented: boolean | null = null;
  try {
    const list = await amilServer().listConsents(customer.externalRef);
    consented = list.consents.some(
      (c) => c.purpose === "pre_decision_insights" && c.withdrawnAt === null,
    );
  } catch {
    consented = null; // AMIL unreachable: show nothing rather than a wrong state
  }
  return (
    <AppShell title={t("settings.title")} path="/settings">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <form action={setLocale.bind(null, "en", "/settings")}>
            <Button type="submit" block variant={locale === "en" ? "default" : "outline"}>
              {t("settings.english")}
            </Button>
          </form>
          <form action={setLocale.bind(null, "ar", "/settings")}>
            <Button type="submit" block variant={locale === "ar" ? "default" : "outline"}>
              {t("settings.arabic")}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.consent")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-ink-muted">{t("settings.consentBody")}</p>
          {consented === null ? null : (
            <form action={setInsightsConsent} className="flex items-center justify-between gap-3">
              <span data-testid="consent-state">
                {consented ? t("settings.granted") : t("settings.withdrawn")}
              </span>
              <input type="hidden" name="grant" value={consented ? "0" : "1"} />
              <Button
                type="submit"
                size="sm"
                variant={consented ? "outline" : "default"}
                data-testid="consent-toggle"
              >
                {consented ? t("settings.withdraw") : t("settings.grant")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Link
        href={actHref("salary.transfer_change")}
        className={buttonVariants({ variant: "outline", block: true })}
        data-testid="move-salary"
      >
        {t("actions.moveSalary")}
      </Link>
    </AppShell>
  );
}
