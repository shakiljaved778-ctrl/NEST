"use client";

import { Button } from "@amil/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall, errorText } from "@/lib/client";
import type { Issue, PackVersion } from "@/lib/types";

type Kind = "number" | "string" | "boolean" | "nullable" | "list" | "rounding";

const kindOf = (key: string, v: unknown): Kind =>
  key === "roundingMode"
    ? "rounding"
    : v === null
      ? "nullable"
      : typeof v === "number"
        ? "number"
        : typeof v === "boolean"
          ? "boolean"
          : Array.isArray(v)
            ? "list"
            : "string";

const toText = (v: unknown): string =>
  v === null || v === undefined
    ? ""
    : Array.isArray(v)
      ? v.map(toText).join(", ")
      : typeof v === "string"
        ? v
        : JSON.stringify(v);

function parse(kind: Kind, text: string, original: unknown): unknown {
  switch (kind) {
    case "number":
      return text.trim() === "" ? text : Number(text);
    case "boolean":
      return text === "true";
    case "nullable":
      return text.trim() === "" ? null : text.trim();
    case "list":
      return text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (typeof (original as unknown[])[0] === "number" ? Number(s) : s));
    default:
      return text;
  }
}

/** Plain-language help for parameters a bank is most likely to change. */
const HINTS: Record<string, string> = {
  programmePointValueQar:
    "Programme value of one point in QAR (up to 4 decimals). Empty: use each card's rewards ledger value.",
  pointsExpiryWindowDays:
    "Points expiring within this many days are called out as 'expiring soon'.",
  roundingMode: "How money is rounded to 2 decimal places.",
};

/**
 * Parameter editor (section 11): edit, review the diff, choose when it takes effect. AMIL
 * validates the result against the pack's own schema before a new version is written.
 */
export function ParamEditor({
  path,
  current,
  defaults,
  canWrite,
}: {
  path: string;
  current: PackVersion;
  /** The pack's default parameters: their types decide each field's editor (null = optional). */
  defaults: Record<string, unknown>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const params = current.parameters;
  const keys = Object.keys(params).sort();
  const kinds = Object.fromEntries(
    keys.map((k) => [k, kindOf(k, k in defaults ? defaults[k] : params[k])]),
  ) as Record<string, Kind>;
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(keys.map((k) => [k, toText(params[k])])),
  );
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [comment, setComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const edited = Object.fromEntries(
    keys.map((k) => [k, parse(kinds[k] ?? "string", text[k] ?? "", params[k])]),
  );
  const changed = keys.filter((k) => JSON.stringify(edited[k]) !== JSON.stringify(params[k]));

  const save = async () => {
    setBusy(true);
    setError(null);
    setIssues([]);
    const r = await adminCall<{ version: string }>("POST", `${path}/versions`, {
      parameters: Object.fromEntries(changed.map((k) => [k, edited[k]])),
      ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom).toISOString() } : {}),
      ...(comment ? { comment } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r.error));
      setIssues(r.issues);
      setReviewing(false);
      return;
    }
    // The page re-renders with the new live version and confirms the save.
    router.replace(`?saved=${encodeURIComponent(r.data.version)}`);
    router.refresh();
  };

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {keys.map((k) => {
          const kind = kinds[k];
          const issue = issues.find((i) => i.path === k || i.path.startsWith(`${k}.`));
          const id = `param-${k}`;
          return (
            <div key={k}>
              <label className="label" htmlFor={id}>
                {k}
              </label>
              {kind === "boolean" ? (
                <select
                  id={id}
                  className="field"
                  disabled={!canWrite}
                  value={text[k]}
                  onChange={(e) => setText({ ...text, [k]: e.target.value })}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : kind === "rounding" ? (
                <select
                  id={id}
                  className="field"
                  disabled={!canWrite}
                  value={text[k]}
                  onChange={(e) => setText({ ...text, [k]: e.target.value })}
                >
                  <option value="half_up">half_up</option>
                  <option value="half_even">half_even (banker&apos;s)</option>
                </select>
              ) : (
                <input
                  id={id}
                  className="field font-mono"
                  disabled={!canWrite}
                  inputMode={kind === "number" ? "numeric" : undefined}
                  placeholder={kind === "nullable" ? "not set" : undefined}
                  value={text[k]}
                  onChange={(e) => setText({ ...text, [k]: e.target.value })}
                />
              )}
              {HINTS[k] ? <p className="mt-1 text-xs text-ink-muted">{HINTS[k]}</p> : null}
              {issue ? (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {issue.message}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {canWrite ? (
        <div className="mt-6 border-t border-line pt-4">
          {reviewing ? (
            <div data-testid="param-diff">
              <h3 className="text-sm font-semibold">Review changes</h3>
              <table className="data mt-2">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Now</th>
                    <th>New</th>
                  </tr>
                </thead>
                <tbody>
                  {changed.map((k) => (
                    <tr key={k}>
                      <td className="font-mono text-xs">{k}</td>
                      <td className="font-mono text-xs text-red-800 line-through">
                        {JSON.stringify(params[k])}
                      </td>
                      <td className="font-mono text-xs text-emerald-800">
                        {JSON.stringify(edited[k])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="effective-from">
                    Effective from (empty: immediately)
                  </label>
                  <input
                    id="effective-from"
                    type="datetime-local"
                    className="field"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="change-comment">
                    Reason for the change
                  </label>
                  <input
                    id="change-comment"
                    className="field"
                    maxLength={500}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => void save()}>
                  Save as new version
                </Button>
                <Button size="sm" variant="outline" onClick={() => setReviewing(false)}>
                  Back to editing
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button size="sm" disabled={!changed.length} onClick={() => setReviewing(true)}>
                Review {changed.length || ""} change{changed.length === 1 ? "" : "s"}
              </Button>
              {error ? (
                <span className="text-sm text-red-700" role="alert">
                  {error}
                </span>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-muted">Your role can read these parameters only.</p>
      )}
    </div>
  );
}
