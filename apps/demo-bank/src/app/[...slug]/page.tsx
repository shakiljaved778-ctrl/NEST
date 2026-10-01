import { buttonVariants, Card, CardContent } from "@amil/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";

/**
 * Any other bank screen an AMIL option deep-links to (confirmations, payments, transfers…).
 * In the demo they are placeholders: AMIL's job ends at the deep link (non-negotiable 3).
 */
export default async function BankScreen({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query, t] = await Promise.all([params, searchParams, getTranslations()]);
  const path = `/${slug.map((s) => s.replace(/[^A-Za-z0-9._-]/g, "")).join("/")}`;
  const details = Object.entries(query)
    .filter((e): e is [string, string] => typeof e[1] === "string")
    .map(([k, v]) => [k.replace(/[^A-Za-z]/g, ""), v.replace(/[^A-Za-z0-9._:-]/g, "")]);
  return (
    <AppShell title={t("screen.title")} back="/" path={path}>
      <Card>
        <CardContent className="space-y-3 pt-4 text-sm" data-testid="bank-screen">
          <p className="font-mono text-xs text-ink-muted" data-testid="bank-screen-path">
            {path}
          </p>
          <p>{t("screen.body")}</p>
          {details.length > 0 ? (
            <dl className="divide-y divide-black/5 text-xs">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd>
                    <bdi>{v}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardContent>
      </Card>
      <Link href="/" className={buttonVariants({ variant: "outline", block: true })}>
        {t("screen.done")}
      </Link>
    </AppShell>
  );
}
