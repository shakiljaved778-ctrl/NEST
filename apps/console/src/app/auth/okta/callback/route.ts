import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookie";
import { bankClient } from "@/lib/env";
import { exchangeCode, verifyIdToken } from "@/lib/oidc";
import { ATTEMPT_COOKIE, oktaConfig, oktaDiscovery } from "@/lib/okta";

/**
 * Okta redirects back here. Check the state, exchange the code (PKCE), verify the ID token, then
 * match the verified email to an active AMIL console user and mint their console token. Roles
 * come from AMIL, never from the identity provider (D-077).
 */
export async function GET(req: NextRequest) {
  const cfg = oktaConfig();
  if (!cfg) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${reason}`, cfg.redirectUri));
    res.cookies.delete({ name: ATTEMPT_COOKIE, path: "/auth/okta" });
    return res;
  };
  const raw = req.cookies.get(ATTEMPT_COOKIE)?.value;
  const attempt = raw
    ? (JSON.parse(raw) as { state: string; nonce: string; verifier: string })
    : null;
  const code = req.nextUrl.searchParams.get("code");
  if (!attempt || !code || req.nextUrl.searchParams.get("state") !== attempt.state)
    return fail("sign_in_failed");
  let email: string;
  try {
    const discovery = await oktaDiscovery(cfg);
    const idToken = await exchangeCode(discovery, cfg, code, attempt.verifier);
    ({ email } = await verifyIdToken(idToken, discovery, cfg, attempt.nonce));
  } catch (e) {
    console.error("okta sign-in failed", e instanceof Error ? e.message : e);
    return fail("sign_in_failed");
  }
  const amil = bankClient();
  const { users } = await amil.listConsoleUsers();
  const user = users.find((u) => u.email.toLowerCase() === email);
  if (!user) return fail("not_authorised");
  const session = await amil.createConsoleSession(user.id, "okta");
  const res = NextResponse.redirect(new URL("/", cfg.redirectUri));
  res.cookies.delete({ name: ATTEMPT_COOKIE, path: "/auth/okta" });
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production" && process.env.CONSOLE_INSECURE_COOKIE !== "1",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return res;
}
