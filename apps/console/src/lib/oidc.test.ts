import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import {
  authorizationUrl,
  discover,
  exchangeCode,
  newAttempt,
  oidcConfigFromEnv,
  verifyIdToken,
} from "./oidc";

const cfg = {
  issuer: "https://bank.okta.test/oauth2/default",
  clientId: "console-client",
  clientSecret: "s3cret",
  redirectUri: "https://console.bank.test/auth/okta/callback",
};
const d = {
  issuer: cfg.issuer,
  authorization_endpoint: `${cfg.issuer}/v1/authorize`,
  token_endpoint: `${cfg.issuer}/v1/token`,
  jwks_uri: `${cfg.issuer}/v1/keys`,
};

async function keys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  return { privateKey, jwks: createLocalJWKSet({ keys: [jwk] }) };
}

const token = (
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
  opts: { iss?: string; aud?: string; exp?: string } = {},
) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? cfg.issuer)
    .setAudience(opts.aud ?? cfg.clientId)
    .setSubject("00u123")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(privateKey);

describe("Okta OIDC (D-077)", () => {
  it("reads its settings from the environment, or stays off", () => {
    expect(oidcConfigFromEnv({})).toBeNull();
    expect(
      oidcConfigFromEnv({
        OKTA_ISSUER: `${cfg.issuer}/`,
        OKTA_CLIENT_ID: cfg.clientId,
        OKTA_CLIENT_SECRET: cfg.clientSecret,
        CONSOLE_PUBLIC_URL: "https://console.bank.test/",
      }),
    ).toEqual(cfg);
    expect(() => oidcConfigFromEnv({ OKTA_ISSUER: cfg.issuer })).toThrow(/needs/);
  });

  it("builds a PKCE (S256) authorization request with state and nonce", () => {
    const a = newAttempt();
    expect(a.verifier).not.toBe(newAttempt().verifier);
    const url = new URL(authorizationUrl(d, cfg, a));
    expect(url.origin + url.pathname).toBe(d.authorization_endpoint);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      scope: "openid email profile",
      state: a.state,
      nonce: a.nonce,
      code_challenge: a.challenge,
      code_challenge_method: "S256",
    });
  });

  it("discovers the issuer and refuses a document for another issuer", async () => {
    const ok = vi.fn(() => Promise.resolve(Response.json(d)));
    expect(await discover(cfg, ok)).toEqual(d);
    expect(ok).toHaveBeenCalledWith(`${cfg.issuer}/.well-known/openid-configuration`, {
      cache: "no-store",
    });
    const other = vi.fn(() => Promise.resolve(Response.json({ ...d, issuer: "https://evil" })));
    await expect(discover(cfg, other)).rejects.toThrow("issuer mismatch");
  });

  it("exchanges the code with the verifier and client authentication", async () => {
    const f = vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(Response.json({ id_token: "tok" })),
    );
    expect(await exchangeCode(d, cfg, "code1", "ver1", f)).toBe("tok");
    const init = f.mock.calls[0]?.[1];
    const body = init?.body as string;
    expect(body).toContain("code_verifier=ver1");
    expect(body).toContain("grant_type=authorization_code");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from("console-client:s3cret").toString("base64")}`,
    );
    const bad = vi.fn(() => Promise.resolve(new Response("{}", { status: 400 })));
    await expect(exchangeCode(d, cfg, "c", "v", bad)).rejects.toThrow("token exchange failed");
  });

  it("verifies the ID token: signature, issuer, audience, nonce and a verified email", async () => {
    const { privateKey, jwks } = await keys();
    const good = await token(privateKey, { nonce: "n1", email: "Compliance@DDB.example.test" });
    expect(await verifyIdToken(good, d, cfg, "n1", jwks)).toEqual({
      sub: "00u123",
      email: "compliance@ddb.example.test",
    });
    await expect(verifyIdToken(good, d, cfg, "other", jwks)).rejects.toThrow("nonce");
    const wrongAud = await token(privateKey, { nonce: "n1", email: "a@b" }, { aud: "x" });
    await expect(verifyIdToken(wrongAud, d, cfg, "n1", jwks)).rejects.toThrow();
    const wrongIss = await token(privateKey, { nonce: "n1", email: "a@b" }, { iss: "https://x" });
    await expect(verifyIdToken(wrongIss, d, cfg, "n1", jwks)).rejects.toThrow();
    const unverified = await token(privateKey, {
      nonce: "n1",
      email: "a@b",
      email_verified: false,
    });
    await expect(verifyIdToken(unverified, d, cfg, "n1", jwks)).rejects.toThrow("not verified");
    const other = await keys();
    const forged = await token(other.privateKey, { nonce: "n1", email: "a@b" });
    await expect(verifyIdToken(forged, d, cfg, "n1", jwks)).rejects.toThrow();
  });
});
