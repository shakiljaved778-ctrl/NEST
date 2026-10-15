/**
 * Console staff management (D-081), against TEST_DATABASE_URL in a bank of its own, so the
 * shared demo users are never touched. The approval log is append-only, so runs never clean up:
 * each run uses fresh emails and resets the fixed users first.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@amil/db";
import { MockProvider, ModelGateway } from "@amil/gateway";
import { signRequest } from "@amil/sdk/server";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { MemoryReplayStore } from "./auth/hmac";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-10-15T08:00:00Z");
const BANK = "bank_staff_test";
const CONSOLE_KEY = {
  keyId: "staff-console-key",
  secret: "k".repeat(40),
  bankId: BANK,
  purpose: "console" as const,
};
const FIXED = [
  { id: "cu_st_admin", email: "admin@staff.example.test", name: "Admin", role: "admin" },
  { id: "cu_st_admin2", email: "admin2@staff.example.test", name: "Admin 2", role: "admin" },
  { id: "cu_st_comp", email: "comp@staff.example.test", name: "Compliance", role: "compliance" },
  { id: "cu_st_product", email: "product@staff.example.test", name: "Product", role: "product" },
] as const;

describe.skipIf(!url)("console staff (integration)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  let app: FastifyInstance;
  const tokens: Record<string, string> = {};
  let counter = 0;

  const signed = (method: "GET" | "POST", path: string, payload?: unknown) => {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    const ts = String(Math.floor(NOW.getTime() / 1000) - (counter++ % 250));
    return app.inject({
      method,
      url: path,
      headers: {
        "x-amil-key": CONSOLE_KEY.keyId,
        "x-amil-timestamp": ts,
        "x-amil-signature": signRequest(CONSOLE_KEY.secret, ts, method, path, body),
        "content-type": "application/json",
      },
      ...(payload === undefined ? {} : { payload: body }),
    });
  };
  const as = (who: string, method: "GET" | "POST" | "PATCH", path: string, payload?: unknown) =>
    app.inject({
      method,
      url: path,
      headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/json" },
      ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    });
  const signIn = async (id: string) => {
    const res = await signed("POST", "/v1/admin/sessions", { consoleUserId: id });
    return res.statusCode === 201 ? res.json<{ token: string }>().token : null;
  };

  beforeAll(async () => {
    await prisma.bank.upsert({
      where: { id: BANK },
      update: {},
      create: {
        id: BANK,
        name: "Staff Test Bank (fictional)",
        nameAr: "بنك اختبار الموظفين",
        supportedLocales: ["en"],
        brandTokens: {},
        deepLinkScheme: "stafftest://",
        severityThresholds: {},
      },
    });
    for (const u of FIXED) {
      await prisma.consoleUser.upsert({
        where: { id: u.id },
        create: { ...u, bankId: BANK },
        update: { role: u.role, active: true },
      });
    }
    app = await buildApp({
      checks: {},
      v1: {
        prisma,
        gateway: new ModelGateway({
          redactedProvider: new MockProvider({ latencyMs: 1 }),
          timeoutMs: 1500,
        }),
        apiKeys: [CONSOLE_KEY],
        sessionSecret: "s".repeat(40),
        auditHashSecret: "a".repeat(40),
        replayStore: new MemoryReplayStore(() => NOW.getTime()),
        clock: () => NOW,
      },
    });
    for (const u of FIXED) tokens[u.id] = (await signIn(u.id)) ?? "";
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("only admins change staff; compliance can see who has access", async () => {
    expect((await as("cu_st_comp", "GET", "/v1/admin/staff")).statusCode).toBe(200);
    expect((await as("cu_st_product", "GET", "/v1/admin/staff")).statusCode).toBe(403);
    const add = { email: `x-${randomUUID()}@staff.example.test`, name: "X", role: "viewer" };
    expect((await as("cu_st_comp", "POST", "/v1/admin/staff", add)).statusCode).toBe(403);
    expect((await as("cu_st_product", "POST", "/v1/admin/staff", add)).statusCode).toBe(403);
  });

  it("adds a person, who can then sign in, and logs it", async () => {
    const email = `New.Person-${randomUUID()}@Staff.example.test`;
    const res = await as("cu_st_admin", "POST", "/v1/admin/staff", {
      email,
      name: "New Person",
      role: "product",
    });
    expect(res.statusCode).toBe(201);
    const added = res.json<{ id: string; email: string; role: string; active: boolean }>();
    expect(added).toMatchObject({ email: email.toLowerCase(), role: "product", active: true });
    expect(await signIn(added.id)).toBeTruthy();

    const again = await as("cu_st_admin", "POST", "/v1/admin/staff", {
      email: email.toLowerCase(),
      name: "Twice",
      role: "viewer",
    });
    expect(again.statusCode).toBe(400);
    expect(again.json<{ error: string }>().error).toBe("email_exists");

    const log = await prisma.approvalLog.findFirst({
      where: { bankId: BANK, entityType: "console_user", entityId: added.id, action: "added" },
    });
    expect(log).toMatchObject({ actorId: "cu_st_admin", toStatus: "product" });
  });

  it("changes a role and deactivates with a reason; deactivation ends access at once", async () => {
    const email = `leaver-${randomUUID()}@staff.example.test`;
    const { id } = (
      await as("cu_st_admin", "POST", "/v1/admin/staff", { email, name: "Leaver", role: "product" })
    ).json<{ id: string }>();
    tokens[id] = (await signIn(id)) ?? "";
    expect((await as(id, "GET", "/v1/admin/rule-packs")).statusCode).toBe(200);

    const noReason = await as("cu_st_admin", "PATCH", `/v1/admin/staff/${id}`, { role: "viewer" });
    expect(noReason.statusCode).toBe(400);

    const role = await as("cu_st_admin", "PATCH", `/v1/admin/staff/${id}`, {
      role: "viewer",
      comment: "Moved to read-only",
    });
    expect(role.json<{ role: string }>().role).toBe("viewer");
    // The role is re-read on every request: their existing token is a viewer's now.
    const me = (await as(id, "GET", "/v1/admin/me")).json<{ user: { role: string } }>();
    expect(me.user.role).toBe("viewer");

    const off = await as("cu_st_admin", "PATCH", `/v1/admin/staff/${id}`, {
      active: false,
      comment: "Left the bank",
    });
    expect(off.json<{ active: boolean }>().active).toBe(false);
    expect((await as(id, "GET", "/v1/admin/me")).statusCode).toBe(401);
    expect(await signIn(id)).toBeNull();

    const log = await prisma.approvalLog.findMany({
      where: { bankId: BANK, entityType: "console_user", entityId: id },
      orderBy: { at: "asc" },
    });
    expect(log.map((l) => [l.action, l.comment])).toEqual([
      ["added", null],
      ["role_changed", "Moved to read-only"],
      ["deactivated", "Left the bank"],
    ]);
  });

  it("never lets admins change their own access", async () => {
    const res = await as("cu_st_admin", "PATCH", "/v1/admin/staff/cu_st_admin", {
      role: "compliance",
      comment: "Promote myself",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBe("self_change");
  });

  it("keeps at least one active compliance officer", async () => {
    const res = await as("cu_st_admin", "PATCH", "/v1/admin/staff/cu_st_comp", {
      active: false,
      comment: "Testing the guard",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBe("last_compliance");

    // With a second compliance officer, the first can change role.
    const { id } = (
      await as("cu_st_admin", "POST", "/v1/admin/staff", {
        email: `comp-${randomUUID()}@staff.example.test`,
        name: "Compliance 2",
        role: "compliance",
      })
    ).json<{ id: string }>();
    const moved = await as("cu_st_admin", "PATCH", "/v1/admin/staff/cu_st_comp", {
      role: "viewer",
      comment: "Handover to Compliance 2",
    });
    expect(moved.statusCode).toBe(200);
    // Restore for the next run's guard test: retire the extra officer, give cu_st_comp back.
    await as("cu_st_admin", "PATCH", "/v1/admin/staff/cu_st_comp", {
      role: "compliance",
      comment: "Restore",
    });
    await as("cu_st_admin", "PATCH", `/v1/admin/staff/${id}`, {
      active: false,
      comment: "Restore",
    });
  });

  it("is in the OpenAPI document", async () => {
    const doc = (await app.inject({ method: "GET", url: "/docs/json" })).json<{
      paths: Record<string, Record<string, unknown>>;
    }>();
    expect(Object.keys(doc.paths["/v1/admin/staff"] ?? {}).sort()).toEqual(["get", "post"]);
    expect(Object.keys(doc.paths["/v1/admin/staff/{id}"] ?? {})).toEqual(["patch"]);
  });
});
