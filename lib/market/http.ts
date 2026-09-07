/** Small helpers shared by the market API routes. */
import type { PlanTier } from "@/types/market";

/** Parse & validate the plan query param (defaults to free). */
export function planFromRequest(req: Request): PlanTier {
  const url = new URL(req.url);
  const p = url.searchParams.get("plan");
  return p === "premium" ? "premium" : "free";
}

export function param(req: Request, key: string): string | null {
  return new URL(req.url).searchParams.get(key);
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found"): Response {
  return json({ error: message }, { status: 404 });
}
