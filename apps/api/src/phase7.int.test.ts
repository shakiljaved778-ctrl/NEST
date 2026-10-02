/**
 * Phase 7 integration tests (TEST_DATABASE_URL): the console API. Acceptance:
 * changing the point value changes Khalid's next insight; disabling card.close removes the
 * insight immediately; the complaints lookup shows Khalid's history. Plus RBAC, the approval
 * workflow, template preview, audit search / event chain / export, dashboard and compliance pack.
 */
import { buildSeedData, PrismaClient, type TemplateStatus, verifyBankChain } from "@amil/db";
import { MockProvider, ModelGateway } from "@amil/gateway";
import type { CheckResponse } from "@amil/sdk";
import { signRequest } from "@amil/sdk/server";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_SEED_NOW } from "../vitest.global-setup";
import { buildApp } from "./app";
import { MemoryReplayStore } from "./auth/hmac";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date(TEST_SEED_NOW);
const KEY = { keyId: "ddb-test-p7", secret: "r".repeat(40), bankId: "bank_ddb" };
const AUDIT_SECRET = "a".repeat(40);
const SESSION_SECRET = "s".repeat(40);

let counter = 0;
function signedHeaders(method: string, path: string, body: string) {
  const ts = String(Math.floor(NOW.getTime() / 1000) - (counter++ % 250));
  return {
    "x-amil-key": KEY.keyId,
    "x-amil-timestamp": ts,
    "x-amil-signature": signRequest(KEY.secret, ts, method, path, body),
    "content-type": "application/json",
  };
}

describe.skipIf(!url)("Phase 7: bank console API (integration)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  const seed = buildSeedData(NOW);
  const khalid = seed.customers.find((c) => c.personaKey === "khalid");
  const KHALID = khalid?.externalRef ?? "";
  let app: FastifyInstance;
  const tokens: Record<string, string> = {};

  const signed = async (method: "GET" | "POST", path: string, payload?: unknown) => {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    return app.inject({
      method,
      url: path,
      headers: signedHeaders(method, path, body),
      ...(payload === undefined ? {} : { payload: body }),
    });
  };
  const as = (role: string, method: "GET" | "POST" | "PATCH", path: string, payload?: unknown) =>
    app.inject({
      method,
      url: path,
      headers: { authorization: `Bearer ${tokens[role]}`, "content-type": "application/json" },
      ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    });
  const check = async () => {
    const res = await signed("POST", "/v1/checks", {
      action: "card.close",
      customerRef: KHALID,
      context: { cardId: "card_khalid_platinum" },
      locale: "en",
    });
    return res.json<CheckResponse>();
  };

  let seededPacks: string[] = [];
  let seededTemplates: { id: string; status: TemplateStatus; enabled: boolean }[] = [];

  beforeAll(async () => {
    app = await buildApp({
      checks: {},
      v1: {
        prisma,
        gateway: new ModelGateway({
          redactedProvider: new MockProvider({ latencyMs: 1 }),
          timeoutMs: 1500,
        }),
        apiKeys: [KEY],
        sessionSecret: SESSION_SECRET,
        auditHashSecret: AUDIT_SECRET,
        replayStore: new MemoryReplayStore(() => NOW.getTime()),
        clock: () => NOW,
      },
    });
    // Tests change rule packs and templates: remember the seeded state to restore it.
    seededPacks = (
      await prisma.rulePack.findMany({ where: { bankId: "bank_ddb" }, select: { id: true } })
    ).map((r) => r.id);
    seededTemplates = await prisma.template.findMany({
      where: { bankId: "bank_ddb" },
      select: { id: true, status: true, enabled: true },
    });
    const users = (await signed("GET", "/v1/admin/users")).json<{
      users: { id: string; role: string }[];
    }>().users;
    for (const u of users) {
      const res = await signed("POST", "/v1/admin/sessions", { consoleUserId: u.id });
      expect(res.statusCode).toBe(201);
      tokens[u.role] = res.json<{ token: string }>().token;
    }
  });
  afterAll(async () => {
    // Leave the seeded state for the other integration files.
    await prisma.rulePack.deleteMany({ where: { bankId: "bank_ddb", id: { notIn: seededPacks } } });
    await prisma.rulePack.updateMany({ where: { bankId: "bank_ddb" }, data: { enabled: true } });
    await prisma.template.deleteMany({
      where: { bankId: "bank_ddb", id: { notIn: seededTemplates.map((t) => t.id) } },
    });
    for (const t of seededTemplates)
      await prisma.template.update({
        where: { id: t.id },
        data: { status: t.status, enabled: t.enabled },
      });
    await app.close();
    await prisma.$disconnect();
  });

  describe("acceptance", () => {
    it("changing the point value in the console changes Khalid's next insight", async () => {
      expect((await check()).card?.headline).toBe(
        "Closing this card forfeits 42,000 points (about QAR 420.00)",
      );
      const res = await as(
        "product",
        "POST",
        "/v1/admin/rule-packs/card.close/conventional/versions",
        {
          parameters: { programmePointValueQar: "0.0125" },
          comment: "Programme rate review",
        },
      );
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        version: "1.1.1",
        diff: {
          before: { programmePointValueQar: null },
          after: { programmePointValueQar: "0.0125" },
        },
      });
      const next = await check();
      expect(next.card?.headline).toBe(
        "Closing this card forfeits 42,000 points (about QAR 525.00)",
      );
      const event = await prisma.insightEvent.findUnique({ where: { id: next.insightId } });
      expect(event?.rulePackVersion).toBe("1.1.1");
      // The change is logged with its diff and its author.
      const log = await prisma.approvalLog.findFirst({
        where: { action: "parameters_changed" },
        orderBy: { at: "desc" },
      });
      expect([log?.actorId, log?.comment]).toEqual(["cu_product", "Programme rate review"]);
    });

    it("disabling card.close removes the insight immediately, and enabling brings it back", async () => {
      const off = await as("compliance", "PATCH", "/v1/admin/rule-packs/card.close/conventional", {
        enabled: false,
        comment: "Incident",
      });
      expect(off.json()).toEqual({ key: "card.close", variant: "conventional", enabled: false });
      expect((await check()).kind).toBe("none");
      await as("compliance", "PATCH", "/v1/admin/rule-packs/card.close/conventional", {
        enabled: true,
      });
      expect((await check()).kind).toBe("insight");
    });

    it("the complaints lookup shows Khalid's history: what he saw and how he responded", async () => {
      const shown = await check();
      await signed("POST", `/v1/insights/${shown.insightId}/responses`, {
        action: "chose_option",
        optionKey: "redeem_points",
      });
      const res = await as("compliance", "GET", `/v1/admin/complaints?customerRef=${KHALID}`);
      expect(res.statusCode).toBe(200);
      const body = res.json<{
        chainVerified: boolean;
        insights: {
          id: string;
          headline: string;
          facts: unknown[];
          options: { key: string }[];
          responses: { action: string; optionKey: string | null }[];
        }[];
      }>();
      expect(body.chainVerified).toBe(true);
      const mine = body.insights.find((i) => i.id === shown.insightId);
      expect(mine?.headline).toBe(shown.card?.headline);
      expect(mine?.facts.length).toBeGreaterThan(0);
      expect(mine?.options.map((o) => o.key)).toContain("redeem_points");
      expect(mine?.responses).toEqual([
        expect.objectContaining({ action: "chose_option", optionKey: "redeem_points" }),
      ]);
      // Only insights actually shown: suppressed checks (kill switch) are not listed as seen.
      expect(body.insights.every((i) => i.headline)).toBe(true);
    });
  });

  describe("RBAC and segregation of duties", () => {
    it.each([
      [
        "viewer",
        "POST",
        "/v1/admin/rule-packs/card.close/conventional/versions",
        { parameters: { pointsExpiryWindowDays: 60 } },
        403,
      ],
      [
        "compliance",
        "POST",
        "/v1/admin/rule-packs/card.close/conventional/versions",
        { parameters: { pointsExpiryWindowDays: 60 } },
        403,
      ],
      ["product", "GET", `/v1/admin/complaints?customerRef=${KHALID}`, undefined, 403],
      ["product", "GET", "/v1/admin/audit", undefined, 403],
      ["viewer", "PATCH", "/v1/admin/rule-packs/card.close/conventional", { enabled: false }, 403],
      ["admin", "GET", "/v1/admin/audit/export?format=csv", undefined, 403],
      ["viewer", "GET", "/v1/admin/dashboard", undefined, 200],
      ["sharia", "GET", "/v1/admin/compliance", undefined, 200],
    ] as const)("%s %s %s -> %d", async (role, method, path, payload, status) => {
      expect((await as(role, method, path, payload)).statusCode).toBe(status);
    });

    it("a widget session cannot use the console, and a console token cannot run checks", async () => {
      const widget = (await signed("POST", "/v1/sessions", { customerRef: KHALID })).json<{
        token: string;
      }>().token;
      const res = await app.inject({
        method: "GET",
        url: "/v1/admin/me",
        headers: { authorization: `Bearer ${widget}` },
      });
      expect(res.statusCode).toBe(401);
      const checkWithConsole = await as("admin", "POST", "/v1/checks", {
        action: "card.close",
        customerRef: KHALID,
        context: { cardId: "card_khalid_platinum" },
      });
      expect(checkWithConsole.statusCode).toBe(401);
      expect((await app.inject({ method: "GET", url: "/v1/admin/me" })).statusCode).toBe(401);
    });

    it("parameter validation rejects bad values before anything is stored", async () => {
      const res = await as(
        "product",
        "POST",
        "/v1/admin/rule-packs/card.close/conventional/versions",
        {
          parameters: { pointsExpiryWindowDays: 9999, programmePointValueQar: 0.01 },
        },
      );
      expect(res.statusCode).toBe(400);
      const body = res.json<{ error: string; issues: { path: string }[] }>();
      expect(body.error).toBe("invalid_parameters");
      expect(body.issues.map((i) => i.path).sort()).toEqual([
        "pointsExpiryWindowDays",
        "programmePointValueQar",
      ]);
    });
  });

  describe("templates: drafts, approval workflow, kill switch, preview", () => {
    const base = async (key: string, locale = "en") =>
      (await prisma.template.findFirst({
        where: { key, locale: locale as "en", status: { in: ["approved", "sharia_approved"] } },
      }))!;

    it("product drafts -> compliance approves -> it is served; the old version is retired", async () => {
      const b = await base("card.close.conventional.critical");
      const draftRes = await as("product", "POST", "/v1/admin/templates", {
        baseId: b.id,
        headline: "Closing this card ends {pointsBalance} points (about {pointsValue})",
        body: b.body,
      });
      expect(draftRes.statusCode).toBe(201);
      const draft = draftRes.json<{ id: string; status: string; version: number }>();
      expect([draft.status, draft.version]).toEqual(["draft", b.version + 1]);
      // Not served while in draft or review.
      expect((await check()).card?.headline).toMatch(/^Closing this card forfeits/);
      expect(
        (
          await as("compliance", "POST", `/v1/admin/templates/${draft.id}/transitions`, {
            action: "approve",
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await as("product", "POST", `/v1/admin/templates/${draft.id}/transitions`, {
            action: "submit",
          })
        ).json(),
      ).toMatchObject({ status: "in_review" });
      // Product cannot approve its own copy.
      expect(
        (
          await as("product", "POST", `/v1/admin/templates/${draft.id}/transitions`, {
            action: "approve",
          })
        ).statusCode,
      ).toBe(403);
      const approved = await as(
        "compliance",
        "POST",
        `/v1/admin/templates/${draft.id}/transitions`,
        { action: "approve", comment: "OK" },
      );
      expect(approved.json()).toMatchObject({ status: "approved", approvedBy: "cu_compliance" });
      expect((await check()).card?.headline).toMatch(/^Closing this card ends 42,000 points/);
      expect((await prisma.template.findUnique({ where: { id: b.id } }))?.status).toBe("retired");
      const detail = (await as("viewer", "GET", `/v1/admin/templates/${draft.id}`)).json<{
        history: { action: string }[];
      }>();
      expect(detail.history.map((h) => h.action)).toEqual([
        "approved",
        "submitted",
        "draft_created",
      ]);
    });

    it("Islamic copy needs compliance and then the Sharia reviewer", async () => {
      const b = await base("card.close.islamic.critical");
      const draft = (
        await as("product", "POST", "/v1/admin/templates", {
          baseId: b.id,
          headline: b.headline,
          body: `${b.body} `,
        })
      ).json<{ id: string }>();
      await as("product", "POST", `/v1/admin/templates/${draft.id}/transitions`, {
        action: "submit",
      });
      expect(
        (
          await as("compliance", "POST", `/v1/admin/templates/${draft.id}/transitions`, {
            action: "approve",
          })
        ).json(),
      ).toMatchObject({ status: "compliance_approved" });
      expect(
        (
          await as("compliance", "POST", `/v1/admin/templates/${draft.id}/transitions`, {
            action: "sharia_approve",
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await as("sharia", "POST", `/v1/admin/templates/${draft.id}/transitions`, {
            action: "sharia_approve",
          })
        ).json(),
      ).toMatchObject({ status: "sharia_approved" });
    });

    it("drafts are checked: selling terms, Islamic terminology, unknown facts and literal figures", async () => {
      const conv = await base("card.close.conventional.caution");
      const isl = await base("card.close.islamic.caution");
      const bad = await as("product", "POST", "/v1/admin/templates", {
        baseId: conv.id,
        headline: "Special offer! Keep your {pointsBalance} points",
        body: "Redeem 500 points with {customerName}.",
      });
      expect(bad.statusCode).toBe(400);
      const issues = bad
        .json<{ issues: { path: string; message: string }[] }>()
        .issues.map((i) => i.message);
      expect(issues).toEqual(
        expect.arrayContaining([
          "banned_term:offer",
          "exclamation_mark",
          "unknown fact: customerName",
          "figures must come from facts, not literal digits",
        ]),
      );
      const islamic = await as("product", "POST", "/v1/admin/templates", {
        baseId: isl.id,
        headline: "Interest on your card",
        body: isl.body,
      });
      expect(
        islamic.json<{ issues: { message: string }[] }>().issues.map((i) => i.message),
      ).toContain("conventional_term_in_islamic_copy:interest");
    });

    it("a template kill switch stops it being served", async () => {
      const live = await prisma.template.findFirst({
        where: { key: "card.close.conventional.critical", locale: "en", status: "approved" },
      });
      await as("product", "PATCH", `/v1/admin/templates/${live?.id}`, { enabled: false });
      expect((await check()).kind).toBe("none");
      await as("product", "PATCH", `/v1/admin/templates/${live?.id}`, { enabled: true });
      expect((await check()).kind).toBe("insight");
    });

    it("previews draft copy against a synthetic customer for whom the pack fires", async () => {
      const res = await as("product", "POST", "/v1/admin/templates/preview", {
        rulePackKey: "deposit.break",
        variant: "conventional",
        locale: "ar",
        severity: "critical",
        headline:
          "إبقاء هذه الوديعة {daysToMaturity} يوماً إضافياً يمنحك {differenceIfKeptToMaturity} أكثر",
        body: "{unknownFact}",
      });
      const p = res.json<{ sample: string; headline: string; missing: string[] }>();
      expect(p.sample).toBe("aisha");
      expect(p.headline).toBe("إبقاء هذه الوديعة 9 يوماً إضافياً يمنحك 9,012.33 ر.ق أكثر");
      expect(p.missing).toEqual(["unknownFact"]);
    });

    it("a headline with alternative sections is measured by its longest reading", async () => {
      const base = (
        await as(
          "viewer",
          "GET",
          "/v1/admin/templates?rulePackKey=salary.transfer_change&locale=en",
        )
      )
        .json<{ templates: { id: string; key: string; headline: string; status: string }[] }>()
        .templates.find(
          (t) =>
            t.key === "salary.transfer_change.islamic.caution" && t.status === "sharia_approved",
        );
      expect(base?.headline.match(/\[\[/g)?.length).toBeGreaterThan(1);
      const res = await as("product", "POST", "/v1/admin/templates/preview", {
        rulePackKey: "salary.transfer_change",
        variant: "islamic",
        locale: "en",
        headline: base?.headline,
        body: "x",
        baseId: base?.id,
      });
      expect(res.json<{ issues: unknown[] }>().issues).toEqual([]);
    });

    it("with the template being edited, preview runs the draft checks live", async () => {
      const base = (
        await as("viewer", "GET", "/v1/admin/templates?rulePackKey=card.close&locale=en")
      )
        .json<{ templates: { id: string; variant: string; severity: string; status: string }[] }>()
        .templates.find(
          (t) =>
            t.variant === "conventional" && t.severity === "critical" && t.status === "approved",
        );
      const res = await as("product", "POST", "/v1/admin/templates/preview", {
        rulePackKey: "card.close",
        variant: "conventional",
        locale: "en",
        severity: "critical",
        headline: "Upgrade now and keep {pointsBalance} points",
        body: "Only 3 days left.",
        baseId: base?.id,
      });
      const p = res.json<{ issues: { path: string; message: string }[] }>();
      expect(p.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["headline", "body"]));
      expect(p.issues.some((i) => i.message.includes("figures must come from facts"))).toBe(true);
      expect(p.issues.some((i) => /upgrade/i.test(i.message))).toBe(true);
    });
  });

  describe("audit, dashboard and compliance pack", () => {
    it("searches by customer ref (matched by hash), shows one event with its chain check, and exports", async () => {
      const shown = await check();
      const search = (
        await as(
          "compliance",
          "GET",
          `/v1/admin/audit?customerRef=${KHALID}&rulePackKey=card.close&limit=5`,
        )
      ).json<{ events: { id: string }[] }>();
      expect(search.events[0]?.id).toBe(shown.insightId);
      const one = (await as("admin", "GET", `/v1/admin/audit/${shown.insightId}`)).json<{
        chain: object;
        event: { customerRefHash: string };
      }>();
      expect(one.chain).toEqual({ hashValid: true, linkValid: true });
      expect(one.event.customerRefHash).not.toContain(KHALID);
      const csv = await as(
        "compliance",
        "GET",
        `/v1/admin/audit/export?format=csv&customerRef=${KHALID}`,
      );
      expect(csv.headers["content-type"]).toContain("text/csv");
      expect(csv.payload.split("\n")[0]).toBe(
        "seq,occurredAt,trigger,rulePackKey,rulePackVersion,variant,locale,applicable,severity,templateKey,validatorResult,modelProvider,latencyMs,headline,suppressed,hash",
      );
      expect(csv.payload).not.toContain(KHALID);
      const json = await as(
        "compliance",
        "GET",
        `/v1/admin/audit/export?format=json&customerRef=${KHALID}`,
      );
      expect((JSON.parse(json.payload) as unknown[]).length).toBeGreaterThan(0);
      expect((await as("compliance", "GET", "/v1/admin/audit/verify")).json()).toMatchObject({
        ok: true,
      });
    });

    it("the dashboard counts insights, responses, reconsidered actions and value protected", async () => {
      const d = (await as("viewer", "GET", "/v1/admin/dashboard")).json<{
        totals: {
          shown: number;
          reconsidered: number;
          valueProtectedQar: string;
          latencyP95Ms: number;
        };
        byPack: { key: string; critical: number }[];
        responses: { chose_option: number };
      }>();
      expect(d.totals.shown).toBeGreaterThan(0);
      expect(d.totals.reconsidered).toBeGreaterThan(0);
      expect(Number(d.totals.valueProtectedQar)).toBeGreaterThan(0);
      expect(d.byPack.find((p) => p.key === "card.close")?.critical).toBeGreaterThan(0);
      expect(d.responses.chose_option).toBeGreaterThan(0);
      expect(d.totals.latencyP95Ms).toBeGreaterThanOrEqual(0);
    });

    it("the compliance pack carries the model card, data fields per pack and a redacted payload", async () => {
      const c = (await as("viewer", "GET", "/v1/admin/compliance")).json<{
        modelCard: { providers: { redacted: { name: string } }; promptVersion: string };
        packs: { key: string; requiredData: unknown[] }[];
        redaction: { samplePayload: unknown };
        retention: { auditRetentionYears: number };
      }>();
      expect(c.modelCard.providers.redacted.name).toBe("mock");
      expect(c.modelCard.promptVersion).toBe("insight.v1");
      expect(c.packs).toHaveLength(24);
      expect(c.retention.auditRetentionYears).toBe(10);
      const payload = JSON.stringify(c.redaction.samplePayload);
      expect(payload).toContain("QAR 420.00");
      for (const pii of ["Khalid", KHALID, "card_khalid_platinum", "0000"])
        expect(payload).not.toContain(pii);
    });

    it("documents every console route in the OpenAPI document with its permission", async () => {
      const doc = (await app.inject({ method: "GET", url: "/docs/json" })).json<{
        paths: Record<string, Record<string, { security: Record<string, unknown>[] }>>;
      }>();
      const admin = Object.entries(doc.paths).filter(([p]) => p.startsWith("/v1/admin/"));
      expect(admin.map(([p]) => p)).toHaveLength(18);
      const ops = admin.flatMap(([, methods]) => Object.values(methods));
      expect(ops).toHaveLength(20);
      expect(ops.filter((o) => "ConsoleSession" in (o.security[0] ?? {}))).toHaveLength(18);
    });

    it("the audit chain still verifies", async () => {
      expect((await verifyBankChain(prisma, "bank_ddb")).ok).toBe(true);
    });
  });
});
