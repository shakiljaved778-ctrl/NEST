import { buttonVariants, Card, CardContent } from "@amil/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";

export default async function ConfirmSettle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  return (
    <AppShell
      title={t("confirm.title")}
      back={`/finance/${id}`}
      path={`/finance/${id}/settle/confirm`}
    >
      <Card>
        <CardContent className="space-y-2 pt-4 text-sm" data-testid="bank-confirm">
          <p>{t("confirm.financeBody")}</p>
          <p className="text-xs text-ink-muted">{t("confirm.note")}</p>
        </CardContent>
      </Card>
      <Link href="/" className={buttonVariants({ block: true })}>
        {t("confirm.home")}
      </Link>
    </AppShell>
  );
}
