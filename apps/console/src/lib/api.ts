import "server-only";
import { apiUrl } from "./env";
import { sessionToken } from "./cookie";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(`AMIL ${status} ${code}`);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await sessionToken();
  if (!token) throw new ApiError(401, "unauthorized");
  const res = await fetch(`${apiUrl()}/v1/admin${path}`, {
    method,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      issues?: { path: string; message: string }[];
    };
    throw new ApiError(res.status, err.error ?? "error", err.issues);
  }
  return (await res.json()) as T;
}

/** Server components read the console API with the signed-in user's token. */
export const adminGet = <T>(path: string) => call<T>("GET", path);
export const adminSend = <T>(method: "POST" | "PATCH", path: string, body: unknown) =>
  call<T>(method, path, body);

export function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return q ? `?${q}` : "";
}
