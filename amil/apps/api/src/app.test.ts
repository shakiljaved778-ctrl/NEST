import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { loadConfig } from "./config";

const ok = () => Promise.resolve();
const fail = () => Promise.reject(new Error("down"));

describe("health endpoints", () => {
  it("GET /healthz is always ok", async () => {
    const app = buildApp({ checks: { postgres: fail } });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", service: "amil-api" });
  });

  it("GET /readyz is 200 when all dependencies answer", async () => {
    const app = buildApp({ checks: { postgres: ok, redis: ok } });
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready", checks: { postgres: "ok", redis: "ok" } });
  });

  it("GET /readyz is 503 and names the failing dependency", async () => {
    const app = buildApp({ checks: { postgres: ok, redis: fail } });
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "not_ready", checks: { postgres: "ok", redis: "fail" } });
  });

  it("does not leak internal error details", async () => {
    const app = buildApp({ checks: {} });
    app.get("/boom", () => {
      throw new Error("secret stack detail");
    });
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("secret");
    expect(res.json()).toEqual({ error: "internal_error" });
  });
});

describe("config", () => {
  it("applies defaults and validates", () => {
    const cfg = loadConfig({ DATABASE_URL: "postgresql://a:b@localhost:5432/x" });
    expect(cfg.API_PORT).toBe(4000);
    expect(cfg.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("fails fast on a missing DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow(/Invalid environment/);
  });
});
