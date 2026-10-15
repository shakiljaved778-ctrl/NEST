// Test-only OpenID Connect provider standing in for Okta in the console e2e (D-077).
// Implements discovery, authorize (auto-approves as the user chosen via /mock/login-as),
// token (checks client credentials and the PKCE verifier) and JWKS. Never used outside tests.
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const PORT = Number(process.env.MOCK_OIDC_PORT ?? 4100);
const ISSUER = `http://localhost:${PORT}`;
const CLIENT_ID = "amil-console-test";
const CLIENT_SECRET = "amil-console-test-secret";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "mock-1", alg: "RS256", use: "sig" };
const codes = new Map();
let nextEmail = "compliance@ddb.example.test";

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, ISSUER);
  if (url.pathname === "/.well-known/openid-configuration")
    return send(res, 200, {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/keys`,
    });
  if (url.pathname === "/keys") return send(res, 200, { keys: [jwk] });
  if (url.pathname === "/mock/login-as") {
    nextEmail = url.searchParams.get("email") ?? nextEmail;
    return send(res, 200, { email: nextEmail });
  }
  if (url.pathname === "/authorize") {
    const p = url.searchParams;
    if (p.get("client_id") !== CLIENT_ID || p.get("code_challenge_method") !== "S256")
      return send(res, 400, { error: "invalid_request" });
    const code = randomBytes(16).toString("base64url");
    codes.set(code, {
      nonce: p.get("nonce"),
      challenge: p.get("code_challenge"),
      redirectUri: p.get("redirect_uri"),
      email: nextEmail,
    });
    const back = new URL(p.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", p.get("state"));
    res.writeHead(302, { location: back.toString() });
    return res.end();
  }
  if (url.pathname === "/token" && req.method === "POST") {
    const auth = Buffer.from((req.headers.authorization ?? "").replace(/^Basic /, ""), "base64")
      .toString()
      .split(":")
      .map(decodeURIComponent);
    if (auth[0] !== CLIENT_ID || auth[1] !== CLIENT_SECRET)
      return send(res, 401, { error: "invalid_client" });
    const form = new URLSearchParams(await readBody(req));
    const entry = codes.get(form.get("code"));
    codes.delete(form.get("code"));
    const challenge = createHash("sha256")
      .update(form.get("code_verifier") ?? "")
      .digest("base64url");
    if (!entry || entry.challenge !== challenge || entry.redirectUri !== form.get("redirect_uri"))
      return send(res, 400, { error: "invalid_grant" });
    const idToken = await new SignJWT({
      nonce: entry.nonce,
      email: entry.email,
      email_verified: true,
    })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setSubject(`00u-${entry.email}`)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    return send(res, 200, { id_token: idToken, token_type: "Bearer" });
  }
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  send(res, 404, { error: "not_found" });
}).listen(PORT, () => console.log(`mock OIDC provider on ${ISSUER}`));
