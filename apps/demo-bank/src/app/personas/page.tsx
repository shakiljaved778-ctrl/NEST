import { Card, CardContent, CardHeader, CardTitle } from "@amil/ui";
import { getTranslations } from "next-intl/server";
import { setPersona } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { listPersonas } from "@/lib/bank";
import { NAMED_PERSONAS } from "@/lib/constants";

export default async function Personas() {
  const [people, t, locale] = await Promise.all([
    listPersonas(),
    getTranslations(),
    currentLocale(),
  ]);
  const named = NAMED_PERSONAS.map((k) => people.find((p) => p.personaKey === k)).filter(
    (p) => p !== undefined,
  );
  const others = people.filter((p) => !NAMED_PERSONAS.includes(p.personaKey ?? ""));
  const list = (items: typeof people) => (
    <div className="grid gap-2">
      {items.map((p) => (
        <form key={p.personaKey} action={setPersona}>
          <input type="hidden" name="persona" value={p.personaKey ?? ""} />
          <button
            type="submit"
            className="flex w-full items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-start text-sm"
            data-testid={`persona-${p.personaKey}`}
          >
            <span>{locale === "ar" ? p.displayNameAr : p.displayName}</span>
            <span className="text-xs text-ink-muted">
              {p.externalRef} · {p.segment}
            </span>
          </button>
        </form>
      ))}
    </div>
  );
  return (
    <AppShell title={t("personas.title")} back="/" path="/personas">
      <p className="text-xs text-ink-muted">{t("personas.subtitle")}</p>
      <Card>
        <CardHeader>
          <CardTitle>{t("personas.named")}</CardTitle>
        </CardHeader>
        <CardContent>{list(named)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("personas.others")}</CardTitle>
        </CardHeader>
        <CardContent>{list(others)}</CardContent>
      </Card>
    </AppShell>
  );
}
