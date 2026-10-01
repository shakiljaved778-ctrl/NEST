/**
 * Phase 5 integration tests against the seeded test database (TEST_DATABASE_URL) and Redis:
 * every action pack end to end, proactive alerts written by a scheduled run (in-process and
 * through BullMQ), the alerts inbox, and explain-my-charge.
 */
import { randomUUID } from "node:crypto";
import {
  bundleFromSeed,
  buildSeedData,
  demoContexts,
  PrismaClient,
  resolvePackInput,
  verifyBankChain,
} from "@amil/db";
import { MockProvider, ModelGateway } from "@amil/gateway";
import type { AlertList, ChargeExplanation, CheckAction, CheckResponse } from "@amil/sdk";
import { signRequest } from "@amil/sdk/server";
import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_SEED_NOW } from "../vitest.global-setup";
import { buildApp } from "./app";
import { MemoryReplayStore } from "./auth/hmac";
import { proactiveQueue, proactiveWorker, syncSchedules } from "./scheduler";
import type { CheckDeps } from "./services/checks";
import { runProactive } from "./services/proactive";

const url = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const NOW = new Date(TEST_SEED_NOW);
const KEY = { keyId: "ddb-test-p5", secret: "p".repeat(40), bankId: "bank_ddb" };
const AUDIT_SECRET = "a".repeat(40);
const SESSION_SECRET = "s".repeat(40);
const ACTIONS: CheckAction[] = [
  "card.close",
  "finance.early_settlement",
  "finance.top_up",
  "card.cash_withdrawal",
  "card.minimum_payment",
  "card.epp_conversion",
  "card.balance_transfer",
  "deposit.break",
  "salary.transfer_change",
  "account.close",
];

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

describe.skipIf(!url)("Phase 5 (integration)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  const gateway = new ModelGateway({
    redactedProvider: new MockProvider({ latencyMs: 1 }),
    timeoutMs: 1500,
  });
  const deps: CheckDeps = {
    prisma,
    gateway,
    auditHashSecret: AUDIT_SECRET,
    clock: () => NOW,
    log: pino({ level: "silent" }),
  };
  const seed = buildSeedData(NOW);
  const ref = (persona: string) => {
    const c = seed.customers.find((x) => x.personaKey === persona);
    if (!c) throw new Error(persona);
    return { id: c.id, ref: c.externalRef };
  };
  let app: FastifyInstance;

  const call = async (method: "GET" | "POST", path: string, payload?: unknown) => {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    return app.inject({
      method,
      url: path,
      headers: signedHeaders(method, path, body),
      ...(payload === undefined ? {} : { payload: body }),
    });
  };
  const session = async (customerRef: string) => {
    const res = await call("POST", "/v1/sessions", { customerRef });
    return res.json<{ token: string }>().token;
  };
  const bearer = (token: string, method: "GET" | "POST", path: string, payload?: unknown) =>
    app.inject({
      method,
      url: path,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    });

  beforeAll(async () => {
    app = await buildApp({
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
    // Alerts are not audit records: start each run from an empty inbox.
    await prisma.alert.deleteMany({ where: { customer: { bankId: "bank_ddb" } } });
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe("every action pack, end to end, for the personas it fires for", () => {
    it.each(ACTIONS.map((a) => [a]))("%s", async (action) => {
      let shown = 0;
      for (const customer of seed.customers) {
        if (customer.personaKey === "priya" || customer.personaKey === "ali") continue;
        const bundle = bundleFromSeed(seed, customer.id);
        for (const context of demoContexts(action, bundle)) {
          if (!resolvePackInput(action, bundle, context, NOW)) continue;
          const res = await call("POST", "/v1/checks", {
            action,
            customerRef: customer.externalRef,
            context,
            locale: shown % 2 ? "ar" : "en",
          });
          expect(res.statusCode, JSON.stringify(context)).toBe(200);
          const body = res.json<CheckResponse>();
          if (body.kind !== "insight") continue;
          shown++;
          const card = body.card;
          if (!card) throw new Error("card");
          expect(card.options.at(-1)?.key).toBe("talk_to_someone");
          for (const o of card.options) expect(o.deepLink).toMatch(/^ddb:\/\/[a-z]/);
          // Every placeholder was filled: no empty query values.
          for (const o of card.options) expect(o.deepLink).not.toMatch(/=(&|$)/);
          // The approved wording passed the number validator (no fallback for a bad number).
          const event = await prisma.insightEvent.findUnique({ where: { id: body.insightId } });
          expect(event?.validatorResult).toBe("passed");
          expect(event?.trigger).toBe(`action:${action}`);
        }
      }
      expect(shown, action).toBeGreaterThanOrEqual(2);
    });

    it("Aisha's deposit break: critical, keep-until-maturity first", async () => {
      const aisha = ref("aisha");
      const deposit = seed.deposits.find((d) => d.customerId === aisha.id);
      const res = await call("POST", "/v1/checks", {
        action: "deposit.break",
        customerRef: aisha.ref,
        context: { depositId: deposit?.id },
        locale: "en",
      });
      const body = res.json<CheckResponse>();
      expect(body.severity).toBe("critical");
      expect(body.card?.headline).toBe("Keeping this deposit 9 more days pays QAR 9,012.33 more");
      expect(body.card?.options.map((o) => o.deepLink)).toEqual([
        `ddb://deposits/${deposit?.id}`,
        `ddb://deposits/${deposit?.id}/break/confirm`,
        "ddb://support/callback?topic=deposit.break",
      ]);
    });

    it("rejects a check without the context its pack needs, and another customer's product", async () => {
      const khalid = ref("khalid");
      const missing = await call("POST", "/v1/checks", {
        action: "card.cash_withdrawal",
        customerRef: khalid.ref,
        context: { cardId: "card_khalid_platinum" },
      });
      expect([missing.statusCode, missing.json()]).toEqual([400, { error: "missing_context" }]);
      const aisha = ref("aisha");
      const foreign = await call("POST", "/v1/checks", {
        action: "deposit.break",
        customerRef: khalid.ref,
        context: { depositId: seed.deposits.find((d) => d.customerId === aisha.id)?.id },
      });
      expect(foreign.statusCode).toBe(404);
      const badAmount = await call("POST", "/v1/checks", {
        action: "card.cash_withdrawal",
        customerRef: khalid.ref,
        context: { cardId: "card_khalid_platinum", amount: 1000 },
      });
      expect(badAmount.statusCode).toBe(400);
    });

    it("a no-consent customer gets generic copy for a new pack, with no figures", async () => {
      const priya = ref("priya");
      const res = await call("POST", "/v1/checks", {
        action: "salary.transfer_change",
        customerRef: priya.ref,
        context: {},
        locale: "ar",
      });
      const body = res.json<CheckResponse>();
      expect(body.kind).toBe("generic");
      expect(body.card?.facts).toEqual([]);
      expect(body.card?.headline).toBe("قبل نقل راتبك");
    });
  });

  describe("proactive alerts", () => {
    it("a scheduled run writes alerts for the personas it fires for, once", async () => {
      const dormancy = await runProactive(deps, "bank_ddb", "account.dormancy");
      const rewards = await runProactive(deps, "bank_ddb", "rewards.expiry");
      expect(dormancy.status).toBe("ran");
      expect(dormancy.alertsCreated).toBeGreaterThanOrEqual(2);
      expect(rewards.alertsCreated).toBeGreaterThanOrEqual(2);
      const alerted = await prisma.alert.findMany({
        select: { rulePackKey: true, customer: { select: { personaKey: true } } },
      });
      const who = (k: string) =>
        alerted.filter((a) => a.rulePackKey === k).map((a) => a.customer.personaKey);
      expect(who("account.dormancy")).toEqual(expect.arrayContaining(["tariq", "grace"]));
      expect(who("rewards.expiry")).toEqual(expect.arrayContaining(["khalid", "noura"]));
      // Customers without consent are never read, let alone alerted.
      expect(alerted.map((a) => a.customer.personaKey)).not.toContain("priya");
      // Re-running the same day alerts nobody again.
      const again = await runProactive(deps, "bank_ddb", "rewards.expiry");
      expect([again.alertsCreated, again.alreadyAlerted]).toEqual([0, rewards.alertsCreated]);
      const job = await prisma.proactiveJob.findFirst({ where: { rulePackKey: "rewards.expiry" } });
      expect(job?.lastRunAt?.toISOString()).toBe(NOW.toISOString());
      // Each alert points at audited insights (one per language) triggered by the schedule.
      const rows = await prisma.alert.findMany({ select: { localeEventIds: true } });
      const ids = rows.flatMap((r) => Object.values(r.localeEventIds as Record<string, string>));
      expect(ids).toHaveLength(rows.length * 2);
      const events = await prisma.insightEvent.findMany({
        where: { id: { in: ids } },
        select: { trigger: true, applicable: true, locale: true },
      });
      expect(events).toHaveLength(ids.length);
      expect(events.every((e) => e.trigger.startsWith("schedule:") && e.applicable)).toBe(true);
    });

    it("Khalid's inbox shows the rewards alert; marking it read; withdrawing consent hides it", async () => {
      const khalid = ref("khalid");
      const token = await session(khalid.ref);
      const res = await bearer(token, "GET", `/v1/alerts?customerRef=${khalid.ref}`);
      expect(res.statusCode).toBe(200);
      const list = res.json<AlertList>();
      const alert = list.alerts.find((a) => a.rulePackKey === "rewards.expiry");
      expect(alert?.insight.card?.headline).toBe(
        "8,000 points worth QAR 80.00 expire on 14 Nov 2026",
      );
      expect(alert?.insight.card?.options.map((o) => o.deepLink)).toEqual([
        "ddb://cards/card_khalid_platinum/rewards",
        "ddb://support/callback?topic=rewards.expiry",
      ]);
      expect(list.unread).toBeGreaterThanOrEqual(1);

      // The same alert, worded and audited in Arabic too, served when the customer reads Arabic.
      const ar = await call("GET", `/v1/alerts?customerRef=${khalid.ref}&locale=ar`);
      const arAlert = ar.json<AlertList>().alerts.find((a) => a.id === alert?.id);
      expect(arAlert?.insight.card?.headline).toBe(
        "تنتهي صلاحية 8,000 نقطة بقيمة 80.00 ر.ق في 14 نوفمبر 2026",
      );
      expect(arAlert?.insight.insightId).not.toBe(alert?.insight.insightId);

      const read = await bearer(token, "POST", `/v1/alerts/${alert?.id}/read`, {});
      expect(read.json<{ readAt: string }>().readAt).toBe(NOW.toISOString());

      // Another customer's session cannot read or mark Khalid's alerts.
      const grace = await session(ref("grace").ref);
      expect((await bearer(grace, "GET", `/v1/alerts?customerRef=${khalid.ref}`)).statusCode).toBe(
        403,
      );
      expect((await bearer(grace, "POST", `/v1/alerts/${alert?.id}/read`, {})).statusCode).toBe(
        403,
      );

      await prisma.consent.updateMany({
        where: { customerId: khalid.id, purpose: "proactive_alerts", withdrawnAt: null },
        data: { withdrawnAt: NOW },
      });
      try {
        const hidden = await bearer(token, "GET", `/v1/alerts?customerRef=${khalid.ref}`);
        expect(hidden.json<AlertList>().alerts).toEqual([]);
      } finally {
        await prisma.consent.updateMany({
          where: { customerId: khalid.id, purpose: "proactive_alerts", withdrawnAt: NOW },
          data: { withdrawnAt: null },
        });
      }
    });

    it.skipIf(!redisUrl)(
      "BullMQ: schedules mirror ProactiveJob rows and the worker writes alerts",
      async () => {
        const prefix = `amil-test-${randomUUID()}`;
        const connection = new Redis(redisUrl ?? "", { maxRetriesPerRequest: null });
        const queue = proactiveQueue(connection, prefix);
        const worker = proactiveWorker(connection.duplicate(), deps, prefix);
        try {
          const synced = await syncSchedules(prisma, queue);
          expect(synced.scheduled.sort()).toEqual([
            "bank_ddb:account.dormancy",
            "bank_ddb:rewards.expiry",
          ]);
          const schedulers = await queue.getJobSchedulers();
          expect(schedulers.map((s) => s.pattern).sort()).toEqual(["0 6 * * *", "15 6 * * *"]);

          await prisma.alert.deleteMany({ where: { rulePackKey: "account.dormancy" } });
          const done = new Promise<unknown>((resolve, reject) => {
            worker.on("completed", (_job, result) => resolve(result));
            worker.on("failed", (_job, error) => reject(error));
          });
          await queue.add("proactive", { bankId: "bank_ddb", packKey: "account.dormancy" });
          const result = (await done) as { alertsCreated: number };
          expect(result.alertsCreated).toBeGreaterThanOrEqual(2);

          // Disabling the job in the console removes its schedule on the next sync.
          await prisma.proactiveJob.updateMany({
            where: { rulePackKey: "account.dormancy" },
            data: { enabled: false },
          });
          const after = await syncSchedules(prisma, queue);
          expect(after.removed).toEqual(["bank_ddb:account.dormancy"]);
        } finally {
          await prisma.proactiveJob.updateMany({
            where: { rulePackKey: "account.dormancy" },
            data: { enabled: true },
          });
          await worker.close();
          await queue.obliterate({ force: true });
          await queue.close();
          connection.disconnect();
        }
      },
    );
  });

  describe("explain my charge", () => {
    const feeLine = async (persona: string, code: string) => {
      const p = ref(persona);
      const t = await prisma.transaction.findFirst({
        where: {
          feeCode: code,
          OR: [{ card: { customerId: p.id } }, { account: { customerId: p.id } }],
        },
        orderBy: { postedAt: "desc" },
      });
      return { ...p, txn: t };
    };
    const explain = async (customerRef: string, transactionId: string, locale = "en") =>
      call("POST", "/v1/explain-charge", { customerRef, transactionId, locale });

    it("every fee line on every consenting statement is explainable", async () => {
      const fees = await prisma.transaction.findMany({
        where: { feeCode: { not: null } },
        include: { card: { select: { customer: true } }, account: { select: { customer: true } } },
      });
      expect(fees.length).toBeGreaterThan(20);
      let matched = 0;
      for (const f of fees) {
        const customer = f.card?.customer ?? f.account?.customer;
        if (!customer || customer.personaKey === "priya" || customer.personaKey === "ali") continue;
        const res = await explain(customer.externalRef, f.id);
        expect(res.statusCode).toBe(200);
        const body = res.json<ChargeExplanation>();
        expect(body.kind).toBe("charge");
        expect(body.name && body.description && body.avoidTip).toBeTruthy();
        expect(body.amount?.value).toBe(f.amount.toFixed(2));
        // Wherever the rule can be recomputed from the statement, it matches the charge.
        expect(body.calculation?.matches).not.toBe(false);
        if (body.calculation?.matches) matched++;
      }
      expect(matched).toBeGreaterThan(10);
    });

    it("a cash withdrawal fee is matched to the withdrawal it was charged on", async () => {
      const { ref: r, txn } = await feeLine("ravi", "CARD_CASH_ADVANCE");
      if (!txn) throw new Error("no cash fee for ravi");
      const body = (await explain(r, txn.id)).json<ChargeExplanation>();
      expect(body.calculation?.kind).toBe("percentage");
      expect(body.calculation?.matches).toBe(true);
      expect(body.calculation?.lines.map((l) => l.label)).toEqual([
        "Transaction it applies to",
        "Fee rate",
        "Minimum fee",
        "Fee under the published rule",
      ]);
      // Matched to the cash withdrawal itself, not to another same-day line the minimum also fits.
      expect(body.calculation?.lines[0]?.display).toMatch(
        /^ATM cash withdrawal \(credit card\) · QAR 1,000\.00$/,
      );
      const ar = (await explain(r, txn.id, "ar")).json<ChargeExplanation>();
      expect(ar.name).toBe("رسوم السحب النقدي");
      const event = await prisma.insightEvent.findUnique({ where: { id: body.explanationId } });
      expect([event?.rulePackKey, event?.trigger, event?.modelProvider]).toEqual([
        "explain.charge",
        "action:explain.charge",
        null,
      ]);
    });

    it("a non-fee line, another customer's line, and no consent", async () => {
      const khalid = ref("khalid");
      const purchase = await prisma.transaction.findFirst({
        where: { type: "purchase", card: { customerId: khalid.id } },
      });
      const none = (await explain(khalid.ref, purchase?.id ?? "")).json<ChargeExplanation>();
      expect([none.kind, none.calculation]).toEqual(["none", null]);

      const { txn } = await feeLine("ravi", "CARD_CASH_ADVANCE");
      expect((await explain(khalid.ref, txn?.id ?? "")).statusCode).toBe(404);

      const priya = ref("priya");
      const anyFee = await prisma.transaction.findFirst({
        where: {
          feeCode: { not: null },
          OR: [{ card: { customerId: priya.id } }, { account: { customerId: priya.id } }],
        },
      });
      const generic = (await explain(priya.ref, anyFee?.id ?? "x")).json<ChargeExplanation>();
      expect([generic.kind, generic.amount, generic.feeCode]).toEqual(["generic", null, null]);
    });
  });

  describe("inbound events", () => {
    it("records an event once; a retry with the same key is acknowledged as a duplicate", async () => {
      const key = `evt-${randomUUID()}`;
      const event = {
        idempotencyKey: key,
        type: "transaction.posted",
        occurredAt: NOW.toISOString(),
        customerRef: ref("khalid").ref,
        payload: { transactionId: "txn_x", amount: "120.00" },
      };
      const first = await call("POST", "/v1/events", event);
      expect(first.statusCode).toBe(201);
      const retry = await call("POST", "/v1/events", event);
      expect(retry.statusCode).toBe(200);
      expect(retry.json()).toMatchObject({
        eventId: first.json<{ eventId: string }>().eventId,
        duplicate: true,
      });
      expect(await prisma.inboundEvent.count({ where: { idempotencyKey: key } })).toBe(1);
    });

    it("is for the bank backend only, and rejects unknown types and unknown customers", async () => {
      const token = await session(ref("khalid").ref);
      const body = {
        idempotencyKey: `evt-${randomUUID()}`,
        type: "card.updated",
        occurredAt: NOW.toISOString(),
        payload: {},
      };
      expect((await bearer(token, "POST", "/v1/events", body)).statusCode).toBe(403);
      expect((await call("POST", "/v1/events", { ...body, type: "nope" })).statusCode).toBe(400);
      expect(
        (await call("POST", "/v1/events", { ...body, customerRef: "DDB-C-9999" })).statusCode,
      ).toBe(404);
    });
  });

  it("the audit chain still verifies", async () => {
    const result = await verifyBankChain(prisma, "bank_ddb");
    expect(result.ok).toBe(true);
  });
});
