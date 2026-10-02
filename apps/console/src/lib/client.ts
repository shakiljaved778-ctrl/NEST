/** Browser-side calls to the console API through the console's own proxy (cookie auth). */
import type { Issue } from "./types";

export type CallResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string; issues: Issue[] };

export async function adminCall<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<CallResult<T>> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (res.ok) return { ok: true, data: (await res.json()) as T };
  const err = (await res.json().catch(() => ({}))) as { error?: string; issues?: Issue[] };
  return { ok: false, status: res.status, error: err.error ?? "error", issues: err.issues ?? [] };
}

export const ERROR_TEXT: Record<string, string> = {
  forbidden: "Your role cannot do this.",
  invalid_parameters: "Some parameters are not valid.",
  no_change: "Nothing changed.",
  invalid_effective_date: "The effective date must be now or later.",
  invalid_template: "The copy does not pass the checks.",
  invalid_transition: "This step is not available in the template's current state.",
  not_found: "Not found.",
  unauthorized: "Your session has ended. Sign in again.",
};
export const errorText = (code: string) => ERROR_TEXT[code] ?? `Request failed (${code}).`;
