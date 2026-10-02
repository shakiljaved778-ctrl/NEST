"use client";

import { Button } from "@amil/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminCall, errorText } from "@/lib/client";
import type { Issue, Preview, Severity, Template } from "@/lib/types";

const SEVERITIES: Severity[] = ["critical", "caution", "info"];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function PreviewCard({
  title,
  preview,
  locale,
}: {
  title: string;
  preview: Preview | null;
  locale: "en" | "ar";
}) {
  return (
    <div className="rounded-md border border-line bg-zinc-50 p-3" data-testid={`preview-${title}`}>
      <p className="text-[11px] tracking-wide text-ink-muted uppercase">
        {title}
        {preview?.sample ? ` · demo customer: ${preview.sample}` : ""}
        {preview?.severity ? ` (${preview.severity})` : ""}
      </p>
      {preview ? (
        <div dir={locale === "ar" ? "rtl" : "ltr"} lang={locale} className="mt-2">
          <p className="font-semibold">{preview.headline}</p>
          <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">{preview.body}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">Rendering…</p>
      )}
    </div>
  );
}

/**
 * Template editor (section 11): edit copy with a live preview against demo customers at each
 * severity, the counterpart language beside it, the copy checks (banned and selling terms, Sharia
 * terminology, figures only from facts) as you type, then the approval workflow.
 */
export function TemplateEditor({
  template,
  counterpart,
  permissions,
}: {
  template: Template;
  counterpart: Template | null;
  permissions: string[];
}) {
  const router = useRouter();
  const canDraft = permissions.includes("templates:write");
  const [headline, setHeadline] = useState(template.headline);
  const [body, setBody] = useState(template.body);
  const [labels, setLabels] = useState(template.options.map((o) => o.label));
  const [comment, setComment] = useState("");
  const [previews, setPreviews] = useState<Partial<Record<Severity, Preview>>>({});
  const [other, setOther] = useState<Preview | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const draft = useDebounced({ headline, body }, 350);
  // Insight copy previews at every severity; generic, Ask AMIL and compare phrases at their own.
  const isPack =
    !template.key.endsWith(".generic") && !/^(assistant|compare)\./.test(template.rulePackKey);

  useEffect(() => {
    let live = true;
    const run = async () => {
      const severities = isPack
        ? [template.severity, ...SEVERITIES.filter((s) => s !== template.severity)]
        : [template.severity];
      const results = await Promise.all(
        severities.map((severity) =>
          adminCall<Preview>("POST", "/templates/preview", {
            rulePackKey: template.rulePackKey,
            variant: template.variant,
            locale: template.locale,
            severity,
            headline: draft.headline,
            body: draft.body,
            baseId: template.id,
          }),
        ),
      );
      if (!live) return;
      const next: Partial<Record<Severity, Preview>> = {};
      results.forEach((r, i) => {
        const s = severities[i];
        if (r.ok && s) next[s] = r.data;
      });
      setPreviews(next);
      const first = results[0];
      setIssues(first?.ok ? (first.data.issues ?? []) : []);
    };
    void run();
    return () => {
      live = false;
    };
  }, [draft, isPack, template]);

  useEffect(() => {
    if (!counterpart) return;
    void adminCall<Preview>("POST", "/templates/preview", {
      rulePackKey: counterpart.rulePackKey,
      variant: counterpart.variant,
      locale: counterpart.locale,
      severity: counterpart.severity,
      headline: counterpart.headline,
      body: counterpart.body,
    }).then((r) => setOther(r.ok ? r.data : null));
  }, [counterpart]);

  const changed =
    headline !== template.headline ||
    body !== template.body ||
    labels.some((l, i) => l !== template.options[i]?.label);
  const missing = previews[template.severity]?.missing ?? [];

  const saveDraft = async () => {
    setBusy(true);
    setMessage(null);
    const r = await adminCall<Template>("POST", "/templates", {
      baseId: template.id,
      headline,
      body,
      options: template.options.map((o, i) => ({ key: o.key, label: labels[i] ?? o.label })),
      ...(comment ? { comment } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      setIssues(r.issues);
      setMessage({ ok: false, text: errorText(r.error) });
      return;
    }
    router.push(`/templates/${r.data.id}`);
  };

  const issueFor = (path: string) =>
    issues.filter((i) => i.path === path || i.path.startsWith(`${path}.`));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="t-headline">
              Headline
            </label>
            <textarea
              id="t-headline"
              rows={2}
              className="field font-mono"
              dir={template.locale === "ar" ? "rtl" : "ltr"}
              disabled={!canDraft}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
            {issueFor("headline").map((i) => (
              <p key={i.message} className="mt-1 text-xs text-red-700">
                {i.message}
              </p>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="t-body">
              Body
            </label>
            <textarea
              id="t-body"
              rows={9}
              className="field font-mono"
              dir={template.locale === "ar" ? "rtl" : "ltr"}
              disabled={!canDraft}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {issueFor("body").map((i) => (
              <p key={i.message} className="mt-1 text-xs text-red-700">
                {i.message}
              </p>
            ))}
          </div>
          {template.options.length ? (
            <div>
              <p className="label">Options (deep links; keys and order are fixed)</p>
              <div className="space-y-2">
                {template.options.map((o, i) => (
                  <div key={o.key} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 font-mono text-[11px] text-ink-muted">
                      {o.key}
                    </span>
                    <input
                      aria-label={`Label for ${o.key}`}
                      className="field"
                      dir={template.locale === "ar" ? "rtl" : "ltr"}
                      disabled={!canDraft}
                      value={labels[i] ?? ""}
                      onChange={(e) =>
                        setLabels(labels.map((l, j) => (j === i ? e.target.value : l)))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <p className="text-xs text-ink-muted">
            Placeholders: <span className="font-mono">{"{factKey}"}</span> inserts a computed
            figure; <span className="font-mono">{"[[factKey: text]]"}</span> shows text only when
            the fact applies.
          </p>
        </div>
        <div
          className={`mt-4 rounded-md border p-3 text-sm ${issues.length || missing.length ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
          data-testid="copy-checks"
          role="status"
        >
          {issues.length || missing.length ? (
            <>
              <p className="font-medium text-red-800">Copy checks: {issues.length} issue(s)</p>
              <ul className="mt-1 list-disc ps-5 text-xs text-red-800">
                {issues.map((i) => (
                  <li key={`${i.path}:${i.message}`}>
                    <span className="font-mono">{i.path}</span>: {i.message}
                  </li>
                ))}
                {missing.length ? (
                  <li>No value for the demo customer: {missing.join(", ")}</li>
                ) : null}
              </ul>
            </>
          ) : (
            <p className="text-emerald-800">
              Copy checks pass: no selling or banned terms
              {template.variant === "islamic" ? ", Sharia terminology," : ","} figures only from
              facts.
            </p>
          )}
        </div>
        {canDraft ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              aria-label="Comment"
              placeholder="What changed and why"
              className="field max-w-xs"
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!changed || busy || issues.length > 0}
              onClick={() => void saveDraft()}
            >
              Save as new draft
            </Button>
            {message ? (
              <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
                {message.text}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">
        <p className="text-sm font-semibold">Live preview</p>
        {(isPack
          ? [template.severity, ...SEVERITIES.filter((s) => s !== template.severity)]
          : [template.severity]
        ).map((s) => (
          <PreviewCard
            key={s}
            title={s === template.severity ? `${s} (this template)` : s}
            preview={previews[s] ?? null}
            locale={template.locale}
          />
        ))}
        {counterpart ? (
          <PreviewCard
            title={`${counterpart.locale === "ar" ? "Arabic" : "English"} (live counterpart)`}
            preview={other}
            locale={counterpart.locale}
          />
        ) : null}
      </div>
    </div>
  );
}

const ACTIONS: {
  action: "submit" | "approve" | "sharia_approve" | "reject";
  label: string;
  permission: string;
  from: string[];
}[] = [
  {
    action: "submit",
    label: "Submit for compliance review",
    permission: "templates:write",
    from: ["draft"],
  },
  { action: "approve", label: "Approve", permission: "templates:approve", from: ["in_review"] },
  {
    action: "sharia_approve",
    label: "Sharia approve",
    permission: "templates:sharia",
    from: ["compliance_approved"],
  },
  {
    action: "reject",
    label: "Send back to draft",
    permission: "templates:approve",
    from: ["in_review"],
  },
  {
    action: "reject",
    label: "Send back to draft",
    permission: "templates:sharia",
    from: ["compliance_approved"],
  },
];

/** Approval workflow buttons: only the step the signed-in role may take now. */
export function Workflow({ template, permissions }: { template: Template; permissions: string[] }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const available = ACTIONS.filter(
    (a) => a.from.includes(template.status) && permissions.includes(a.permission),
  );
  if (!available.length) return null;
  const run = async (action: string) => {
    setBusy(true);
    setError(null);
    const r = await adminCall<Template>("POST", `/templates/${template.id}/transitions`, {
      action,
      ...(comment ? { comment } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      setError([errorText(r.error), ...r.issues.map((i) => `${i.path}: ${i.message}`)].join(" "));
      return;
    }
    setComment("");
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="workflow">
      <input
        aria-label="Review comment"
        placeholder="Comment (optional)"
        className="field max-w-xs"
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {available.map((a) => (
        <Button
          key={a.action}
          size="sm"
          variant={a.action === "reject" ? "outline" : "default"}
          disabled={busy}
          onClick={() => void run(a.action)}
        >
          {a.label}
        </Button>
      ))}
      {error ? (
        <span className="text-sm text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
