/**
 * Browser security policy shared by the demo bank and the console (D-065). Edge-safe: no Node or
 * React imports, so Next middleware can use it.
 */

/** A fresh nonce per request (base64 of 16 random bytes). */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Content-Security-Policy for a Next app page. Scripts run only with this request's nonce
 * (`strict-dynamic` lets Next's own chunks load). Styles allow inline attributes, which brand
 * tokens and charts use; no script can be injected through them. `connect` lists the origins the
 * page may call (the demo bank's widget calls the AMIL API directly).
 */
export function contentSecurityPolicy(opts: {
  nonce: string;
  connect?: string[];
  dev?: boolean;
}): string {
  const connect = ["'self'", ...(opts.connect ?? [])];
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${opts.nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}${opts.dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Headers for every response (pages and static files), set in next.config. */
export function securityHeaders(production: boolean): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(production
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
      : []),
  ];
}
