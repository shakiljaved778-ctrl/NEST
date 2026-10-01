/**
 * Insight API integration tests against a migrated + seeded PostgreSQL (TEST_DATABASE_URL).
 * Phase 3 acceptance: checks end to end, consent gating, kill switches, approved templates only,
 * validator fallback, audit hash chain verifies, p95 < 400 ms with the mock provider.
 */
import { hashCustomerRef, PrismaClient, verifyBankChain } from "@amil/db";
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
const KEY = { keyId: "ddb-test", secret: "t".repeat(40), bankId: "bank_ddb" };
const AUDIT_SECRET = "a".repeat(40);
const SESSION_SECRET = "s".repeat(40);
const KHALID = "DDB-C-0001";
const FATIMA = "DDB-C-0002";
const PRIYA = "DDB-C-0022";

let counter = 0;
function signedHeaders(method: string, path: string, body: string) {
  // A distinct timestamp per request keeps signatures unique (the replay store rejects repeats).
  const ts = String(Math.floor(NOW.getTime() / 1000) - (counter++ % 200));
  return {
    "x-amil-key": KEY.keyId,
    "x-amil-timestamp": ts,
    "x-amil-signature": signRequest(KEY.secret, ts, method, path, body),
    "content-type": "application/json",
  };
}

describe.skipIf(!url)("AMIL insight API (integration)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  let app: FastifyInstance;
  let gateway: ModelGateway;

  async function makeApp(provider = new MockProvider({ latencyMs: 2 })) {
    gateway = new ModelGateway({ redactedProvider: provider, timeoutMs: 1500 });
    return buildApp({
      checks: {},
      v1: {
        prisma,
        gateway,
        apiKeys: [KEY],
        sessionSecret: SESSION_SECRET,
        auditHashSecret: AUDIT_SECRET,
        replayStore: new MemoryReplayStore(() => NOW.getTime()),
        clock: () => NOW,
      },
    });
  }

  const post = async (path: string, payload: unknown, a: FastifyInstance = app) => {
    const body = JSON.stringify(payload);
    return a.inject({
      method: "POST",
      url: path,
      headers: signedHeaders("POST", path, body),
      payload: body,
    });
  };
  const check = async (payload: object, a?: FastifyInstance) => {
    const res = await post("/v1/checks", payload, a);
    return { status: res.statusCode, body: res.json<CheckResponse>() };
  };

  beforeAll(async () => {
    app = await makeApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe("Khalid closes his card", () => {
    it("returns the critical points insight in English with facts, deep links and why", async () => {
      const { status, body } = await check({
        action: "card.close",
        customerRef: KHALID,
        context: { cardId: "card_khalid_platinum" },
        locale: "en",
      });
      expect(status).toBe(200);
      expect(body).toMatchObject({
        applicable: true,
        kind: "insight",
        severity: "critical",
        requiresAcknowledgement: true,
      });
      const card = body.card;
      if (!card) throw new Error("no card");
      expect(card.headline).toBe("Closing this card forfeits 42,000 points (about QAR 420.00)");
      expect(card.body.length).toBeLessThanOrEqual(280);
      expect(card.facts.find((f) => f.key === "pointsValue")).toMatchObject({
        label: "Value of points",
        value: "420.00",
        display: "QAR 420.00",
        source: "rewards_ledger",
        asOf: "2026-09-30",
      });
      expect(card.options.map((o) => [o.key, o.deepLink])).toEqual([
        ["redeem_points", "ddb://cards/card_khalid_platinum/rewards"],
        ["view_instalments", "ddb://cards/card_khalid_platinum/instalments"],
        ["continue_closure", "ddb://cards/card_khalid_platinum/close/confirm"],
        ["talk_to_someone", "ddb://support/callback?topic=card.close"],
      ]);
      expect(card.options[0]?.label).toBe("Redeem points first");
      expect(card.why).toContain(
        "Your card has reward points, and points end when a card is closed.",
      );
      // The mock provider is not AI: no AI disclosure is claimed.
      expect(card.aiDisclosure).toBe("Figures from Doha Demo Bank records as of 30 Sep 2026.");
    });

    it("returns the Arabic card with RTL-ready Arabic copy", async () => {
      const { body } = await check({
        action: "card.close",
        customerRef: KHALID,
        context: { cardId: "card_khalid_platinum" },
        locale: "ar",
      });
      expect(body.card?.headline).toBe("إغلاق هذه البطاقة يُفقدك 42,000 نقطة (نحو 420.00 ر.ق)");
      expect(body.card?.options[0]).toMatchObject({
        key: "redeem_points",
        label: "استبدل النقاط أولاً",
      });
      expect(body.card?.aiDisclosure).toBe(
        "الأرقام من سجلات بنك الدوحة التجريبي بتاريخ 30 سبتمبر 2026.",
      );
    });

    it("writes an audit event with hashed customer ref, facts, template and what was shown", async () => {
      const { body } = await check({
        action: "card.close",
        customerRef: KHALID,
        context: { cardId: "card_khalid_platinum" },
      });
      const event = await prisma.insightEvent.findUnique({ where: { id: body.insightId } });
      expect(event).toMatchObject({
        bankId: "bank_ddb",
        trigger: "action:card.close",
        customerRefHash: hashCustomerRef(AUDIT_SECRET, "bank_ddb", KHALID),
        rulePackKey: "card.close",
        rulePackVersion: "1.0.0",
        variant: "conventional",
        applicable: true,
        severity: "critical",
        templateKey: "card.close.conventional.critical",
        templateVersion: 1,
        validatorResult: "passed",
        modelProvider: "mock",
        locale: "en",
      });
      expect(
        JSON.stringify(event, (_k, v: unknown) => (typeof v === "bigint" ? String(v) : v)),
      ).not.toContain(KHALID);
      expect(event?.inputSnapshotHash).toMatch(/^[0-9a-f]{64}$/);
      expect((event?.facts as Record<string, { value: string }>).pointsValue?.value).toBe("420.00");
      expect((event?.shown as { headline: string }).headline).toBe(body.card?.headline);
      expect(event?.retentionUntil.toISOString()).toBe("2036-09-30T00:00:00.000Z");
    });
  });

  describe("Fatima settles early", () => {
    it("offers the cheaper date first, with the date in the deep link", async () => {
      const { body } = await check({
        action: "finance.early_settlement",
        customerRef: FATIMA,
        context: { financeId: "fin_fatima_murabaha" },
      });
      expect(body).toMatchObject({ kind: "insight", severity: "critical" });
      expect(body.card?.headline).toBe(
        "السداد في 19 أكتوبر 2026 بدلاً من اليوم يقلّل ما تدفعه بمقدار 4,000.00 ر.ق",
      ); // her preferred locale
      expect(body.card?.options[0]).toMatchObject({
        key: "schedule_settlement",
        deepLink: "ddb://finance/fin_fatima_murabaha/settle/schedule?date=2026-10-19",
      });
      const event = await prisma.insightEvent.findUnique({ where: { id: body.insightId } });
      expect(event).toMatchObject({
        variant: "islamic",
        templateKey: "finance.early_settlement.islamic.critical",
      });
    });
  });

  describe("consent first (non-negotiable 5)", () => {
    it("without consent returns generic information and no figures", async () => {
      const { body } = await check({
        action: "card.close",
        customerRef: PRIYA,
        context: { cardId: "card_priya_classic" },
        locale: "en",
      });
      expect(body).toMatchObject({
        applicable: true,
        kind: "generic",
        severity: "info",
        requiresAcknowledgement: false,
      });
      expect(body.card?.facts).toEqual([]);
      expect(body.card?.headline).toBe("Before you close your card");
      expect(body.card?.body).not.toMatch(/\d/);
      const event = await prisma.insightEvent.findUnique({ where: { id: body.insightId } });
      expect(event).toMatchObject({
        applicable: true,
        templateKey: "card.close.conventional.generic",
        facts: {},
      });
    });

    it("granting consent unlocks the insight; withdrawing it locks it again", async () => {
      const grant = await post("/v1/consents", {
        customerRef: PRIYA,
        purpose: "pre_decision_insights",
        version: "1.0",
        method: "in_app",
        privacyPolicyVersion: "2026-01",
      });
      expect(grant.statusCode).toBe(201);
      expect(
        (
          await check({
            action: "card.close",
            customerRef: PRIYA,
            context: { cardId: "card_priya_classic" },
          })
        ).body.kind,
      ).toBe("insight");
      const path = `/v1/consents/${PRIYA}?purpose=pre_decision_insights`;
      const withdraw = await app.inject({
        method: "DELETE",
        url: path,
        headers: signedHeaders("DELETE", path, ""),
      });
      expect(withdraw.statusCode).toBe(200);
      expect(
        withdraw
          .json<{ consents: { withdrawnAt: string | null }[] }>()
          .consents.every((c) => c.withdrawnAt !== null),
      ).toBe(true);
      expect(
        (
          await check({
            action: "card.close",
            customerRef: PRIYA,
            context: { cardId: "card_priya_classic" },
          })
        ).body.kind,
      ).toBe("generic");
    });
  });

  describe("kill switches (non-negotiable 9) and approval (8)", () => {
    const khalidCheck = () =>
      check({
        action: "card.close",
        customerRef: KHALID,
        context: { cardId: "card_khalid_platinum" },
        locale: "en",
      });

    it("a disabled rule pack returns no insight, never an error", async () => {
      await prisma.rulePack.updateMany({
        where: { bankId: "bank_ddb", key: "card.close", variant: "conventional" },
        data: { enabled: false },
      });
      try {
        const { status, body } = await khalidCheck();
        expect(status).toBe(200);
        expect(body).toEqual({
          insightId: body.insightId,
          applicable: false,
          kind: "none",
          severity: null,
          card: null,
          requiresAcknowledgement: false,
        });
        const event = await prisma.insightEvent.findUnique({ where: { id: body.insightId } });
        expect(event?.shown).toEqual({ suppressed: "rule_pack_disabled" });
      } finally {
        await prisma.rulePack.updateMany({
          where: { bankId: "bank_ddb", key: "card.close", variant: "conventional" },
          data: { enabled: true },
        });
      }
      expect((await khalidCheck()).body.kind).toBe("insight");
    });

    it.each([
      ["disabled", { enabled: false }],
      ["only a draft", { status: "draft" as const }],
    ])("a template that is %s is never served", async (_name, patch) => {
      const where = {
        bankId: "bank_ddb",
        key: "card.close.conventional.critical",
        locale: "en" as const,
      };
      await prisma.template.updateMany({ where, data: patch });
      try {
        const { body } = await khalidCheck();
        expect(body.kind).toBe("none");
      } finally {
        await prisma.template.updateMany({ where, data: { enabled: true, status: "approved" } });
      }
    });

    it("an Islamic template needs sharia_approved, not just approved", async () => {
      const where = {
        bankId: "bank_ddb",
        key: "finance.early_settlement.islamic.critical",
        locale: "ar" as const,
      };
      await prisma.template.updateMany({ where, data: { status: "approved" } });
      try {
        const { body } = await check({
          action: "finance.early_settlement",
          customerRef: FATIMA,
          context: { financeId: "fin_fatima_murabaha" },
        });
        expect(body.kind).toBe("none");
      } finally {
        await prisma.template.updateMany({ where, data: { status: "sharia_approved" } });
      }
    });

    it("invalid stored parameters suppress the insight instead of computing with them", async () => {
      const where = { bankId: "bank_ddb", key: "card.close", variant: "conventional" as const };
      await prisma.rulePack.updateMany({
        where,
        data: { parameters: { pointsExpiryWindowDays: "ninety" } },
      });
      try {
        expect((await khalidCheck()).body.kind).toBe("none");
      } finally {
        await prisma.rulePack.updateMany({
          where,
          data: {
            parameters: {
              pointsExpiryWindowDays: 90,
              pendingCashbackOnClosure: "forfeited",
              roundingMode: "half_up",
            },
          },
        });
      }
    });

    it("a changed point value in the pack's product data flows into the next insight", async () => {
      await prisma.rewardsLedger.update({
        where: { cardId: "card_khalid_platinum" },
        data: { pointValueQar: "0.0200" },
      });
      try {
        expect((await khalidCheck()).body.card?.headline).toBe(
          "Closing this card forfeits 42,000 points (about QAR 840.00)",
        );
      } finally {
        await prisma.rewardsLedger.update({
          where: { cardId: "card_khalid_platinum" },
          data: { pointValueQar: "0.0100" },
        });
      }
    });
  });

  describe("model gateway through the API", () => {
    it("rejected model wording falls back to the approved template and is audited as rejected", async () => {
      const adversarial = await makeApp(
        new MockProvider({
          respond: () => JSON.stringify({ headline: "You lose QAR 999", body: "Act now." }),
        }),
      );
      const res = await post(
        "/v1/checks",
        {
          action: "card.close",
          customerRef: KHALID,
          context: { cardId: "card_khalid_platinum" },
          locale: "en",
        },
        adversarial,
      );
      const body = res.json<CheckResponse>();
      expect(body.card?.headline).toBe(
        "Closing this card forfeits 42,000 points (about QAR 420.00)",
      );
      const event = await prisma.insightEvent.findUnique({ where: { id: body.insightId } });
      expect(event).toMatchObject({ validatorResult: "rejected", modelProvider: null });
      expect((event?.shown as { wordingRejections: string[] }).wordingRejections).toContain(
        "number_not_in_facts:999",
      );
      await adversarial.close();
    });
  });

  describe("sessions, scopes and responses", () => {
    async function session(customerRef: string, scopes?: string[]) {
      const res = await post("/v1/sessions", { customerRef, ...(scopes ? { scopes } : {}) });
      expect(res.statusCode).toBe(201);
      return res.json<{ token: string; expiresAt: string }>();
    }
    const bearer = (token: string, method: "POST" | "GET", path: string, payload?: unknown) =>
      app.inject({
        method,
        url: path,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(payload ? { payload: JSON.stringify(payload) } : {}),
      });

    it("mints a 15-minute token; the widget checks and records a response with it", async () => {
      const { token, expiresAt } = await session(KHALID);
      expect(expiresAt).toBe("2026-09-30T09:15:00.000Z");
      const res = await bearer(token, "POST", "/v1/checks", {
        action: "card.close",
        customerRef: KHALID,
        context: { cardId: "card_khalid_platinum" },
        locale: "en",
      });
      const body = res.json<CheckResponse>();
      expect(body.kind).toBe("insight");
      const resp = await bearer(token, "POST", `/v1/insights/${body.insightId}/responses`, {
        action: "chose_option",
        optionKey: "redeem_points",
      });
      expect(resp.statusCode).toBe(201);
      const stored = await prisma.customerResponse.findFirst({
        where: { insightEventId: body.insightId },
      });
      expect(stored).toMatchObject({ action: "chose_option", optionKey: "redeem_points" });
    });

    it("a session cannot act for another customer or outside its scopes", async () => {
      const { token } = await session(KHALID, ["checks:write"]);
      expect(
        (
          await bearer(token, "POST", "/v1/checks", {
            action: "card.close",
            customerRef: FATIMA,
            context: { cardId: "card_fatima_classic" },
          })
        ).statusCode,
      ).toBe(403);
      expect((await bearer(token, "GET", `/v1/consents/${KHALID}`)).statusCode).toBe(403);
      expect(
        (await bearer(token, "POST", "/v1/sessions", { customerRef: KHALID })).statusCode,
      ).toBe(403);
    });

    it("a session cannot respond to another customer's insight; unknown options are rejected", async () => {
      const { body } = await check({
        action: "card.close",
        customerRef: KHALID,
        context: { cardId: "card_khalid_platinum" },
      });
      const fatima = await session(FATIMA);
      expect(
        (
          await bearer(fatima.token, "POST", `/v1/insights/${body.insightId}/responses`, {
            action: "dismissed",
          })
        ).statusCode,
      ).toBe(403);
      const khalid = await session(KHALID);
      expect(
        (
          await bearer(khalid.token, "POST", `/v1/insights/${body.insightId}/responses`, {
            action: "chose_option",
            optionKey: "apply_for_loan",
          })
        ).statusCode,
      ).toBe(400);
    });

    it("a customer cannot read another customer's product", async () => {
      const { status, body } = await check({
        action: "card.close",
        customerRef: FATIMA,
        context: { cardId: "card_khalid_platinum" },
      });
      expect(status).toBe(404);
      expect(body).toEqual({ error: "not_found" });
    });
  });

  describe("authentication and error hygiene", () => {
    it("rejects unsigned, replayed and tampered requests with generic errors", async () => {
      const body = JSON.stringify({
        action: "card.close",
        customerRef: KHALID,
        context: { cardId: "card_khalid_platinum" },
      });
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/checks",
            headers: { "content-type": "application/json" },
            payload: body,
          })
        ).json(),
      ).toEqual({ error: "unauthorized" });
      const headers = signedHeaders("POST", "/v1/checks", body);
      expect(
        (await app.inject({ method: "POST", url: "/v1/checks", headers, payload: body }))
          .statusCode,
      ).toBe(200);
      expect(
        (await app.inject({ method: "POST", url: "/v1/checks", headers, payload: body }))
          .statusCode,
      ).toBe(401); // replay
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/checks",
            headers: signedHeaders("POST", "/v1/checks", body),
            payload: body.replace("0001", "0002"),
          })
        ).statusCode,
      ).toBe(401);
    });

    it.each([
      ["malformed JSON", "{not json"],
      [
        "an unknown action",
        JSON.stringify({ action: "card.upgrade", customerRef: KHALID, context: {} }),
      ],
      [
        "extra fields",
        JSON.stringify({
          action: "card.close",
          customerRef: KHALID,
          context: { cardId: "x" },
          sql: "1;",
        }),
      ],
    ])("returns a generic 400 for %s", async (_name, payload) => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/checks",
        headers: signedHeaders("POST", "/v1/checks", payload),
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "bad_request" });
    });

    it("serves the OpenAPI 3.1 document and Swagger UI at /docs", async () => {
      const doc = (await app.inject({ method: "GET", url: "/docs/json" })).json<{
        openapi: string;
        paths: Record<string, unknown>;
      }>();
      expect(doc.openapi).toBe("3.1.0");
      expect(Object.keys(doc.paths)).toEqual(
        expect.arrayContaining([
          "/v1/sessions",
          "/v1/checks",
          "/v1/insights/{id}/responses",
          "/v1/consents",
          "/v1/consents/{customerRef}",
        ]),
      );
      expect((await app.inject({ method: "GET", url: "/docs" })).statusCode).toBeLessThan(400);
    });
  });

  describe("performance and audit integrity", () => {
    it("p95 latency of /v1/checks is under 400 ms with the mock provider", async () => {
      // A fresh app (and replay store): earlier tests already used some signed timestamps.
      const perfApp = await makeApp();
      const timings: number[] = [];
      for (let i = 0; i < 200; i++) {
        const t0 = performance.now();
        const { body } = await check(
          {
            action: i % 2 ? "card.close" : "finance.early_settlement",
            customerRef: i % 2 ? KHALID : FATIMA,
            context:
              i % 2 ? { cardId: "card_khalid_platinum" } : { financeId: "fin_fatima_murabaha" },
          },
          perfApp,
        );
        timings.push(performance.now() - t0);
        expect(body.kind).toBe("insight");
      }
      timings.sort((a, b) => a - b);
      const p95 = timings[Math.floor(timings.length * 0.95)] ?? Infinity;
      console.log(
        `/v1/checks over ${timings.length} requests: p50 ${timings[100]?.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`,
      );
      expect(p95).toBeLessThan(400);
      await perfApp.close();
    });

    it("the bank's audit hash chain verifies after all of the above", async () => {
      const result = await verifyBankChain(prisma, "bank_ddb");
      expect(result.ok).toBe(true);
      expect(result.checked).toBeGreaterThan(200);
    });
  });
});
