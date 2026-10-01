import { Card, CardContent } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";

/** Deep-link target of "Talk to someone" (ddb://support/callback?topic=…). */
export default async function Callback({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const [{ topic }, t] = await Promise.all([searchParams, getTranslations()]);
  return (
    <AppShell title={t("support.title")} back="/" path="/support/callback">
      <Card>
        <CardContent className="pt-4 text-sm" data-testid="callback-screen">
          {t("support.body", { topic: (topic ?? "").replace(/[^a-z._]/g, "") })}
        </CardContent>
      </Card>
    </AppShell>
  );
}
