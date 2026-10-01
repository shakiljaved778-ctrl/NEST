import { ErrorResponse } from "./schemas";

export class AmilApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`AMIL API ${status}: ${code}`);
    this.name = "AmilApiError";
  }
}

export async function parseResponse<T>(
  res: Response,
  schema: { parse(v: unknown): T },
): Promise<T> {
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = ErrorResponse.safeParse(json);
    throw new AmilApiError(res.status, err.success ? err.data.error : "unknown_error");
  }
  return schema.parse(json);
}
