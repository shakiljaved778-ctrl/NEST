import { Card, CardContent } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";

export default async function Prepay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  return (
    <AppShell
      title={t("settle.prepayTitle")}
      back={`/finance/${id}`}
      path={`/finance/${id}/prepay`}
    >
      <Card>
        <CardContent className="pt-4 text-sm">{t("settle.prepayBody")}</CardContent>
      </Card>
    </AppShell>
  );
}
