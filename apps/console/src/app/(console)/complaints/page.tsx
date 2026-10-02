import { Badge } from "@amil/ui";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/page-header";
import { adminGet, query } from "@/lib/api";
import { fmtDateTime, packLabel, RESPONSE_LABELS } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import type { Complaints } from "@/lib/types";

const day = (d: string | undefined, end: boolean) =>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T${end ? "23:59:59" : "00:00:00"}+03:00`).toISOString()
    : undefined;

/**
 * Complaints lookup (headline feature): when a customer says "nobody told me", compliance sees
 * exactly what AMIL showed them, in their language, with the figures and sources, the options
 * offered and what they chose, straight from the hash-chained audit log.
 */
export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ customerRef?: string; from?: string; to?: string }>;
}) {
  await requirePermission("complaints:read");
  const sp = await searchParams;
  const ref = sp.customerRef?.trim();
  const result = ref
    ? await adminGet<Complaints>(
        `/complaints${query({ customerRef: ref, from: day(sp.from, false), to: day(sp.to, true) })}`,
      )
    : null;
  return (
    <>
      <PageHeader
        title="Complaints lookup"
        description="Exactly which insights a customer was shown, what each said, and how they responded, from the tamper-evident audit log."
      />
      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label" htmlFor="c-ref">
            Customer reference
          </label>
          <input
            id="c-ref"
            name="customerRef"
            required
            defaultValue={ref ?? ""}
            className="field font-mono"
            placeholder="e.g. DDB-C-0001"
          />
        </div>
        <div>
          <label className="label" htmlFor="c-from">
            From
          </label>
          <input
            id="c-from"
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="c-to">
            To
          </label>
          <input id="c-to" type="date" name="to" defaultValue={sp.to ?? ""} className="field" />
        </div>
        <button type="submit" className="h-[38px] rounded-md bg-brand px-4 text-sm text-white">
          Look up
        </button>
      </form>
      {result ? (
        <div data-testid="complaints-result">
          <p className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span>
              <strong>{result.insights.length}</strong> insight
              {result.insights.length === 1 ? "" : "s"} shown to{" "}
              <span className="font-mono">{result.customerRef}</span>
            </span>
            <Badge tone={result.chainVerified ? "islamic" : "warning"}>
              {result.chainVerified ? "Audit chain verified" : "Audit chain did NOT verify"}
            </Badge>
          </p>
          <ol className="space-y-4">
            {[...result.insights].reverse().map((i) => (
              <li key={i.id}>
                <Panel>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-muted">
                    <span>
                      {fmtDateTime(i.occurredAt)} · {packLabel(i.rulePackKey)} · {i.trigger} ·{" "}
                      {i.locale.toUpperCase()}
                    </span>
                    <Link className="text-brand hover:underline" href={`/audit/${i.id}`}>
                      Audit event #{i.seq}
                    </Link>
                  </div>
                  <div dir={i.locale === "ar" ? "rtl" : "ltr"} lang={i.locale} className="mt-2">
                    {i.question ? (
                      <p className="mb-1 text-sm text-ink-muted">Asked: “{i.question}”</p>
                    ) : null}
                    <p className="font-semibold">
                      {i.severity ? (
                        <Badge
                          tone={i.severity === "critical" ? "brand" : "neutral"}
                          className="me-2"
                        >
                          {i.severity}
                        </Badge>
                      ) : null}
                      {i.headline}
                    </p>
                    {i.body ? <p className="mt-1 text-sm whitespace-pre-line">{i.body}</p> : null}
                    {i.facts.length ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {i.facts.map((f, n) => (
                          <li
                            key={`${f.key ?? n}`}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs"
                          >
                            {f.label ? `${f.label}: ` : ""}
                            <strong>{f.display ?? f.value}</strong>
                            {f.source ? (
                              <span className="text-ink-muted">
                                {" "}
                                · {f.source}
                                {f.asOf ? `, ${f.asOf}` : ""}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {i.options.length ? (
                      <p className="mt-2 text-xs text-ink-muted">
                        Options offered: {i.options.map((o) => o.label).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-3 border-t border-line pt-2 text-sm" data-testid="response">
                    {i.responses.length
                      ? i.responses
                          .map(
                            (r) =>
                              `${RESPONSE_LABELS[r.action] ?? r.action}${r.optionKey ? ` (${i.options.find((o) => o.key === r.optionKey)?.label ?? r.optionKey})` : ""} at ${fmtDateTime(r.at)}`,
                          )
                          .join("; ")
                      : "No response recorded."}
                  </p>
                </Panel>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </>
  );
}
