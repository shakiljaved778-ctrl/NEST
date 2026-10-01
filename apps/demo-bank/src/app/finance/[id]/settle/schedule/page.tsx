import { buttonVariants, Card, CardContent } from "@amil/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { date } from "@/lib/format";

/** Deep-link target of "Settle on the cheaper date" (ddb://finance/{id}/settle/schedule?date=…). */
export default async function Schedule({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ id }, { date: iso }, t, locale] = await Promise.all([
    params,
    searchParams,
    getTranslations(),
    currentLocale(),
  ]);
  const valid = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : null;
  return (
    <AppShell
      title={t("settle.scheduleTitle")}
      back={`/finance/${id}`}
      path={`/finance/${id}/settle/schedule`}
    >
      <Card>
        <CardContent className="pt-4 text-sm" data-testid="schedule-screen">
          {valid ? t("settle.scheduleBody", { date: date(valid, locale) }) : t("soon.body")}
        </CardContent>
      </Card>
      <Link href="/" className={buttonVariants({ block: true })}>
        {t("confirm.home")}
      </Link>
    </AppShell>
  );
}
