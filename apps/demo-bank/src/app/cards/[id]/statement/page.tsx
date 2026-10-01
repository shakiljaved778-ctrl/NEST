import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { Statement } from "@/components/statement";
import { currentLocale } from "@/i18n/request";
import { cardOf, currentCustomer, statementLines } from "@/lib/bank";

export default async function CardStatement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, t, locale] = await Promise.all([
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const card = cardOf(customer, id);
  const lines = await statementLines({ cardId: card.id }, 60);
  return (
    <AppShell
      title={`${t("statement.title")} · ${card.productName}`}
      back={`/cards/${id}`}
      path={`/cards/${id}/statement`}
    >
      <Statement lines={lines} locale={locale} />
    </AppShell>
  );
}
