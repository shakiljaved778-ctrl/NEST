import { Card, CardContent } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";

export default async function Placeholder() {
  const t = await getTranslations();
  return (
    <AppShell title={t("soon.title")} path="/ask">
      <Card>
        <CardContent className="pt-4 text-sm text-ink-muted">{t("soon.body")}</CardContent>
      </Card>
    </AppShell>
  );
}
