import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { loadConfig } from "./config";

const ok = () => Promise.resolve();
const fail = () => Promise.reject(new Error("down"));

describe("health endpoints", () => {
  it("GET /healthz is always ok", async () => {
    const app = await buildApp({ checks: { postgres: fail } });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", service: "amil-api" });
  });

  it("GET /readyz is 200 when all dependencies answer", async () => {
    const app = await buildApp({ checks: { postgres: ok, redis: ok } });
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready", checks: { postgres: "ok", redis: "ok" } });
  });

  it("GET /readyz is 503 and names the failing dependency", async () => {
    const app = await buildApp({ checks: { postgres: ok, redis: fail } });
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "not_ready", checks: { postgres: "ok", redis: "fail" } });
  });

  it("does not leak internal error details", async () => {
    const app = await buildApp({ checks: {} });
    app.get("/boom", () => {
      throw new Error("secret stack detail");
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("secret");
    expect(res.json()).toEqual({ error: "internal_error" });
  });
});

const validEnv = {
  DATABASE_URL: "postgresql://a:b@localhost:5432/x",
  AMIL_API_KEYS: `ddb-demo:${"s".repeat(32)}:bank_ddb`,
  SESSION_SECRET: "x".repeat(32),
  AUDIT_HASH_SECRET: "y".repeat(32),
};

describe("config", () => {
  it("applies defaults and validates", () => {
    const cfg = loadConfig({ ...validEnv });
    expect(cfg.API_PORT).toBe(4000);
    expect(cfg.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("fails fast on a missing DATABASE_URL", () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: undefined })).toThrow(
      /Invalid environment/,
    );
  });

  it("parses API keys and rejects short secrets", () => {
    expect(loadConfig(validEnv).AMIL_API_KEYS).toEqual([
      { keyId: "ddb-demo", secret: "s".repeat(32), bankId: "bank_ddb", purpose: "bank" },
    ]);
    expect(
      loadConfig({
        ...validEnv,
        AMIL_API_KEYS: `ddb-demo:${"s".repeat(32)}:bank_ddb,ddb-console:${"c".repeat(32)}:bank_ddb:console`,
      }).AMIL_API_KEYS.map((k) => k.purpose),
    ).toEqual(["bank", "console"]);
    expect(() =>
      loadConfig({ ...validEnv, AMIL_API_KEYS: `ddb-demo:${"s".repeat(32)}:bank_ddb:admin` }),
    ).toThrow(/Invalid environment/);
    expect(() => loadConfig({ ...validEnv, AMIL_API_KEYS: "ddb-demo:short:bank_ddb" })).toThrow(
      /Invalid environment/,
    );
    expect(() => loadConfig({ ...validEnv, SESSION_SECRET: "short" })).toThrow(
      /Invalid environment/,
    );
  });
});

describe("security headers (D-065)", () => {
  it("sends helmet headers and a deny-all CSP on API responses; /v1 is never cached", async () => {
    const app = await buildApp({ checks: {} });
    app.get("/v1/probe", () => ({ ok: true }));
    const res = await app.inject({ method: "GET", url: "/v1/probe" });
    expect(res.headers["content-security-policy"]).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("Swagger UI keeps its own policy", async () => {
    const app = await buildApp({ checks: {} });
    const res = await app.inject({ method: "GET", url: "/docs" });
    expect(res.statusCode).toBe(200);
    const csp = String(res.headers["content-security-policy"]);
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("rate limits (D-064)", () => {
  const limits = {
    serverPerMinute: 5,
    sessionPerMinute: 3,
    consolePerMinute: 4,
    anonymousPerMinute: 2,
    assistantPerMinute: 1,
  };
  async function hits(headers: Record<string, string>, n: number, url = "/v1/probe") {
    const app = await buildApp({ checks: {}, rateLimit: limits });
    app.get("/v1/probe", () => ({ ok: true }));
    app.get("/v1/admin/probe", () => ({ ok: true }));
    const codes: number[] = [];
    for (let i = 0; i < n; i++)
      codes.push((await app.inject({ method: "GET", url, headers })).statusCode);
    return { app, codes };
  }

  it("limits anonymous callers per IP, with a generic 429 and Retry-After", async () => {
    const { app, codes } = await hits({}, 3);
    expect(codes).toEqual([200, 200, 429]);
    const res = await app.inject({ method: "GET", url: "/v1/probe" });
    expect(res.json()).toEqual({ error: "rate_limited" });
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("counts per session token, per console token and per bank key separately", async () => {
    expect((await hits({ authorization: "Bearer aaa" }, 4)).codes).toEqual([200, 200, 200, 429]);
    expect((await hits({ authorization: "Bearer aaa" }, 5, "/v1/admin/probe")).codes).toEqual([
      200, 200, 200, 200, 429,
    ]);
    expect((await hits({ "x-amil-key": "ddb" }, 6)).codes).toEqual([200, 200, 200, 200, 200, 429]);
    // Another session has its own bucket.
    const { app } = await hits({ authorization: "Bearer aaa" }, 3);
    const other = await app.inject({
      method: "GET",
      url: "/v1/probe",
      headers: { authorization: "Bearer bbb" },
    });
    expect(other.statusCode).toBe(200);
  });

  it("never limits health checks", async () => {
    const app = await buildApp({ checks: {}, rateLimit: limits });
    for (let i = 0; i < 5; i++)
      expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
  });
});
