/** Typed HTTP errors. Bodies stay generic: details never reach a customer-facing surface. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "HttpError";
  }
}
export const badRequest = (code = "bad_request") => new HttpError(400, code);
export const unauthorized = () => new HttpError(401, "unauthorized");
export const forbidden = () => new HttpError(403, "forbidden");
export const notFound = () => new HttpError(404, "not_found");

/** Parse with a Zod-like schema, or throw a generic 400. */
export function parseOr400<T>(
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const r = schema.safeParse(value);
  if (!r.success) throw badRequest();
  return r.data;
}
