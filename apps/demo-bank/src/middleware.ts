import { contentSecurityPolicy, makeNonce } from "@amil/ui/security";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Per-request Content-Security-Policy with a nonce (D-065). Next reads the nonce from the request
 * header and applies it to its own scripts. The widget calls the AMIL API directly, so it is the one extra origin pages may connect to.
 */
export function middleware(request: NextRequest) {
  const nonce = makeNonce();
  const csp = contentSecurityPolicy({
    nonce,
    connect: [process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"],
    dev: process.env.NODE_ENV === "development",
  });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
