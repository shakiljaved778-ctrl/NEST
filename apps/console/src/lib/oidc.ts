/**
 * OpenID Connect sign-in for the console (Okta, D-077): authorization code flow with PKCE, run by
 * the console's backend. Okta proves who the staff member is; their role stays in AMIL, so
 * segregation of duties is decided and audited in one place. No framework imports, so it is
 * unit-tested directly.
 */
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

export interface OidcConfig {
  /** e.g. https://your-bank.okta.com/oauth2/default */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** The console's public callback URL, registered in Okta. */
  redirectUri: string;
}

export interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

/** Okta settings from the environment, or null when the console runs with the demo picker. */
export function oidcConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): OidcConfig | null {
  const { OKTA_ISSUER, OKTA_CLIENT_ID, OKTA_CLIENT_SECRET, CONSOLE_PUBLIC_URL } = env;
  if (!OKTA_ISSUER && !OKTA_CLIENT_ID) return null;
  if (!OKTA_ISSUER || !OKTA_CLIENT_ID || !OKTA_CLIENT_SECRET || !CONSOLE_PUBLIC_URL)
    throw new Error(
      "Okta sign-in needs OKTA_ISSUER, OKTA_CLIENT_ID, OKTA_CLIENT_SECRET and CONSOLE_PUBLIC_URL",
    );
  return {
    issuer: OKTA_ISSUER.replace(/\/$/, ""),
    clientId: OKTA_CLIENT_ID,
    clientSecret: OKTA_CLIENT_SECRET,
    redirectUri: `${CONSOLE_PUBLIC_URL.replace(/\/$/, "")}/auth/okta/callback`,
  };
}

const b64url = (b: Buffer) => b.toString("base64url");

/** State, nonce and PKCE verifier for one sign-in attempt, plus the S256 challenge. */
export function newAttempt() {
  const verifier = b64url(randomBytes(32));
  return {
    state: b64url(randomBytes(16)),
    nonce: b64url(randomBytes(16)),
    verifier,
    challenge: b64url(createHash("sha256").update(verifier).digest()),
  };
}

export async function discover(
  cfg: OidcConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<Discovery> {
  const res = await fetchImpl(`${cfg.issuer}/.well-known/openid-configuration`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OIDC discovery failed (${res.status})`);
  const d = (await res.json()) as Discovery;
  // The document must describe the issuer we were configured with (no mix-up).
  if (d.issuer !== cfg.issuer) throw new Error("OIDC issuer mismatch");
  return d;
}

export function authorizationUrl(
  d: Discovery,
  cfg: OidcConfig,
  a: { state: string; nonce: string; challenge: string },
): string {
  const url = new URL(d.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: "openid email profile",
    state: a.state,
    nonce: a.nonce,
    code_challenge: a.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** Exchange the authorization code (confidential client, client_secret_basic). */
export async function exchangeCode(
  d: Discovery,
  cfg: OidcConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(d.token_endpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(
        `${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`,
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      code_verifier: verifier,
    }).toString(),
  });
  if (!res.ok) throw new Error(`OIDC token exchange failed (${res.status})`);
  const body = (await res.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string") throw new Error("OIDC response has no id_token");
  return body.id_token;
}

/**
 * Verify the ID token: signature against the issuer's keys, issuer, audience, expiry and this
 * attempt's nonce. Returns the verified email (lower case), which must not be unverified.
 */
export async function verifyIdToken(
  idToken: string,
  d: Discovery,
  cfg: OidcConfig,
  nonce: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(d.jwks_uri)),
): Promise<{ sub: string; email: string }> {
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: cfg.issuer,
    audience: cfg.clientId,
    algorithms: ["RS256"],
    clockTolerance: 60,
  });
  if (payload.nonce !== nonce) throw new Error("OIDC nonce mismatch");
  if (payload.email_verified === false) throw new Error("OIDC email is not verified");
  if (typeof payload.email !== "string" || typeof payload.sub !== "string")
    throw new Error("OIDC token has no email");
  return { sub: payload.sub, email: payload.email.toLowerCase() };
}
