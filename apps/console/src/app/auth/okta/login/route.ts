import { NextResponse } from "next/server";
import { authorizationUrl, newAttempt } from "@/lib/oidc";
import { ATTEMPT_COOKIE, oktaConfig, oktaDiscovery } from "@/lib/okta";

/** Start Okta sign-in: remember this attempt in an httpOnly cookie, then go to Okta. */
export async function GET() {
  const cfg = oktaConfig();
  if (!cfg) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const discovery = await oktaDiscovery(cfg);
  const attempt = newAttempt();
  const res = NextResponse.redirect(authorizationUrl(discovery, cfg, attempt));
  res.cookies.set(ATTEMPT_COOKIE, JSON.stringify(attempt), {
    httpOnly: true,
    // Lax: the cookie must come back on Okta's top-level redirect to the callback.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/okta",
    maxAge: 600,
  });
  return res;
}
