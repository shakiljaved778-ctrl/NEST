import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, makeNonce, securityHeaders } from "./security";

describe("security policy", () => {
  it("makes a fresh base64 nonce each time", () => {
    const a = makeNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(makeNonce()).not.toBe(a);
  });

  it("allows scripts only by nonce, and only the listed origins to be called", () => {
    const csp = contentSecurityPolicy({ nonce: "n0nce", connect: ["http://api.test"] });
    expect(csp).toContain("script-src 'self' 'nonce-n0nce' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' http://api.test");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("relaxes only what Next's dev server needs in development", () => {
    const csp = contentSecurityPolicy({ nonce: "n", dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws:");
  });

  it("sends HSTS only in production", () => {
    expect(securityHeaders(true).map((h) => h.key)).toContain("Strict-Transport-Security");
    expect(securityHeaders(false).map((h) => h.key)).not.toContain("Strict-Transport-Security");
  });
});
