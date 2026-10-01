import type { CompareResponse, CompareScenario } from "@amil/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@amil/ui";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { currentLocale } from "@/i18n/request";
import { contextFromQuery } from "@/lib/actions";
import { amilServer } from "@/lib/amil";
import { currentCustomer } from "@/lib/bank";
import { DeepLinkButton } from "@/components/deep-link-button";

const SCENARIOS: Record<
  string,
  { scenario: CompareScenario; back: (q: Record<string, string>) => string }
> = {
  settlement: { scenario: "settlement_timing", back: (q) => `/finance/${q.financeId}` },
  payment: { scenario: "min_vs_custom_payment", back: (q) => `/cards/${q.cardId}` },
  deposit: { scenario: "deposit_break_vs_wait", back: (q) => `/deposits/${q.depositId}` },
};

/**
 * Compare views. The bank backend asks AMIL (HMAC, server-side) for the customer's options side
 * by side; every figure is computed by the same engine as the pre-action checks.
 */
export default async function Compare({
  params,
  searchParams,
}: {
  params: Promise<{ scenario: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ scenario: slug }, query, customer, t, locale] = await Promise.all([
    params,
    searchParams,
    currentCustomer(),
    getTranslations(),
    currentLocale(),
  ]);
  const def = SCENARIOS[slug];
  if (!def) notFound();
  const ctx = contextFromQuery(query);
  const p = {
    ...(ctx.financeId ? { financeId: ctx.financeId } : {}),
    ...(ctx.cardId ? { cardId: ctx.cardId } : {}),
    ...(ctx.depositId ? { depositId: ctx.depositId } : {}),
    ...(ctx.paymentAmount ? { paymentAmount: ctx.paymentAmount } : {}),
  };
  let res: CompareResponse | null = null;
  try {
    res = await amilServer().compare({
      customerRef: customer.externalRef,
      scenario: def.scenario,
      params: p,
      locale,
    });
  } catch (error) {
    console.error("AMIL compare unavailable", error instanceof Error ? error.message : error);
  }
  const rows = res?.options[0]?.facts.map((f) => [f.key, f.label] as const) ?? [];
  return (
    <AppShell title={t(`compare.${slug}`)} back={def.back(p)} path={`/compare/${slug}`}>
      {!res || res.kind !== "comparison" ? (
        <Card>
          <CardContent className="pt-4 text-sm text-ink-muted" data-testid="compare-unavailable">
            {t("compare.unavailable")}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card data-testid="compare-view" data-scenario={res.scenario}>
            <CardHeader>
              <CardTitle data-testid="compare-headline">{res.headline}</CardTitle>
              <p className="text-sm">{res.body}</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th />
                    {res.options.map((o) => (
                      <th
                        key={o.key}
                        className={`p-1 text-start align-bottom ${o.best ? "text-brand" : ""}`}
                        data-option={o.key}
                        data-best={o.best}
                      >
                        {o.title}
                        {o.best ? (
                          <span className="block text-[10px] font-semibold">
                            {t("compare.best")}
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([key, label]) => (
                    <tr key={key} className="border-t border-black/5">
                      <th className="p-1 text-start font-normal text-ink-muted">{label}</th>
                      {res.options.map((o) => (
                        <td key={o.key} className="p-1" data-cell={`${o.key}.${key}`}>
                          <bdi>{o.facts.find((f) => f.key === key)?.display}</bdi>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <div className="grid gap-2">
            {res.actions.map((a, i) => (
              <DeepLinkButton
                key={a.key}
                deepLink={a.deepLink}
                primary={i === 0}
                testId={`compare-action-${a.key}`}
              >
                {a.label}
              </DeepLinkButton>
            ))}
          </div>
          <p className="text-xs text-ink-muted">{res.disclosure}</p>
        </>
      )}
    </AppShell>
  );
}
