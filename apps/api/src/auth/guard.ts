import type { Scope } from "@amil/sdk";
import type { FastifyRequest } from "fastify";
import type { ApiKey } from "../config";
import { forbidden, unauthorized } from "../errors";
import { type ReplayStore, verifyHmac } from "./hmac";
import { type SessionClaims, verifySessionToken } from "./session";

export type AuthContext =
  { kind: "server"; bankId: string; keyId: string } | ({ kind: "session" } & SessionClaims);

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
    auth?: AuthContext;
  }
}

export interface AuthDeps {
  apiKeys: ApiKey[];
  sessionSecret: string;
  replayStore: ReplayStore;
  clock: () => Date;
}

/**
 * Authenticate a request as either the bank's server (HMAC headers) or a widget session (Bearer
 * token). `allowSession` names the scope a session needs. Server calls are trusted for the bank.
 */
export async function authenticate(
  req: FastifyRequest,
  deps: AuthDeps,
  allowSession: Scope | null,
): Promise<AuthContext> {
  const nowSeconds = Math.floor(deps.clock().getTime() / 1000);
  const authz = req.headers.authorization;
  if (authz?.startsWith("Bearer ")) {
    if (!allowSession) throw forbidden();
    const claims = await verifySessionToken(deps.sessionSecret, authz.slice(7), nowSeconds);
    if (!claims) throw unauthorized();
    if (!claims.scopes.includes(allowSession)) throw forbidden();
    return { kind: "session", ...claims };
  }
  const result = await verifyHmac(
    { headers: req.headers, method: req.method, url: req.url, rawBody: req.rawBody ?? "" },
    deps.apiKeys,
    deps.replayStore,
    nowSeconds,
  );
  if (!result.ok) {
    req.log.warn({ reason: result.reason }, "hmac_rejected");
    throw unauthorized();
  }
  return { kind: "server", bankId: result.key.bankId, keyId: result.key.keyId };
}

/** A session may only act for its own customer. */
export function assertCustomer(auth: AuthContext, customerRef: string): void {
  if (auth.kind === "session" && auth.customerRef !== customerRef) throw forbidden();
}
