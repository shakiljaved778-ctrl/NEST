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
      { keyId: "ddb-demo", secret: "s".repeat(32), bankId: "bank_ddb" },
    ]);
    expect(() => loadConfig({ ...validEnv, AMIL_API_KEYS: "ddb-demo:short:bank_ddb" })).toThrow(
      /Invalid environment/,
    );
    expect(() => loadConfig({ ...validEnv, SESSION_SECRET: "short" })).toThrow(
      /Invalid environment/,
    );
  });
});
