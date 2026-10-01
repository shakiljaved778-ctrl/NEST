/**
 * Phase 6 integration tests (TEST_DATABASE_URL): compare views match the engine, and Ask AMIL
 * end to end over server-sent events (Khalid's card question with fact chips, refusals, compare,
 * explain a charge, clarification, consent, audit).
 */
import {
  bundleFromSeed,
  buildSeedData,
  PrismaClient,
  resolvePackInput,
  verifyBankChain,
} from "@amil/db";
import { MockProvider, ModelGateway } from "@amil/gateway";
import { getPack, type PackKey } from "@amil/rule-packs";
import type { AnyFactSet, Fact } from "@amil/rules-engine";
import type { AssistantAnswer, CompareResponse } from "@amil/sdk";
import { signRequest } from "@amil/sdk/server";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_SEED_NOW } from "../vitest.global-setup";
import { buildApp } from "./app";
import { GRAPH_STEPS } from "./assistant/graph";
import { MemoryReplayStore } from "./auth/hmac";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date(TEST_SEED_NOW);
const KEY = { keyId: "ddb-test-p6", secret: "q".repeat(40), bankId: "bank_ddb" };
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

interface Streamed {
  status: number;
  events: { event: string; data: unknown }[];
  answer: AssistantAnswer;
  text: string;
}

describe.skipIf(!url)("Phase 6 (integration)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  const seed = buildSeedData(NOW);
  const persona = (key: string) => {
    const c = seed.customers.find((x) => x.personaKey === key);
    if (!c) throw new Error(key);
    return { id: c.id, ref: c.externalRef };
  };
  let app: FastifyInstance;

  const post = async (path: string, payload: unknown) => {
    const body = JSON.stringify(payload);
    return app.inject({
      method: "POST",
      url: path,
      headers: signedHeaders("POST", path, body),
      payload: body,
    });
  };
  const compare = async (payload: object) => {
    const res = await post("/v1/compare", payload);
    return { status: res.statusCode, body: res.json<CompareResponse>() };
  };
  const ask = async (
    customerRef: string,
    message: string,
    extra: object = {},
  ): Promise<Streamed> => {
    const res = await post("/v1/assistant/messages", { customerRef, message, ...extra });
    const events = res.payload
      .split("\n\n")
      .filter(Boolean)
      .map((block) => {
        const event = /^event: (.+)$/m.exec(block)?.[1] ?? "";
        const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? "null") as unknown;
        return { event, data };
      });
    const answer = events.find((e) => e.event === "answer")?.data as AssistantAnswer;
    const text = events
      .filter((e) => e.event === "delta")
      .map((e) => (e.data as { text: string }).text)
      .join("");
    return { status: res.statusCode, events, answer, text };
  };
  /** The engine's own evaluation of a seeded product, for comparing against the API. */
  const engine = (personaKey: string, pack: PackKey, context: object): AnyFactSet => {
    const p = persona(personaKey);
    const resolved = resolvePackInput(pack, bundleFromSeed(seed, p.id), context, NOW);
    if (!resolved) throw new Error("unresolved");
    const def = getPack(pack, resolved.variant);
    return def.evaluate(
      resolved.input as never,
      def.defaultParameters,
      { cautionAtQar: "0", criticalAtQar: "0" },
      NOW,
    ).facts;
  };
  const v = (facts: AnyFactSet, key: string) => (facts[key] as Fact).value;

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
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe("compare views match the engine", () => {
    it("settlement timing (Fatima's murabaha)", async () => {
      const financeId = seed.finances.find((f) => f.customerId === persona("fatima").id)?.id ?? "";
      const { status, body } = await compare({
        customerRef: persona("fatima").ref,
        scenario: "settlement_timing",
        params: { financeId },
        locale: "en",
      });
      expect(status).toBe(200);
      const ev = engine("fatima", "finance.early_settlement", { financeId });
      const cheapest = body.options.find((o) => o.key === "cheapest_date");
      const today = body.options.find((o) => o.key === "today");
      const chip = (o: typeof today, k: string) => o?.facts.find((f) => f.key === k)?.value;
      expect(chip(today, "totalOutflow")).toBe(v(ev, "netOutflowToday"));
      expect(chip(cheapest, "settlementDate")).toBe(v(ev, "cheapestSettlementDate"));
      expect(chip(cheapest, "totalOutflow")).toBe(v(ev, "netOutflowOnCheapestDate"));
      expect(chip(cheapest, "savingVsToday")).toBe(v(ev, "savingIfSettledOnCheapestDate"));
      expect(cheapest?.best).toBe(true);
      expect(cheapest?.title).toBe("Cheapest date");
      expect(body.headline).toMatch(/^Settling on .+ costs QAR 4,000\.00 less than today$/);
      expect(cheapest?.action?.deepLink).toBe(
        `ddb://finance/${financeId}/settle/schedule?date=${v(ev, "cheapestSettlementDate")}`,
      );
      expect(body.actions.at(-1)?.key).toBe("talk_to_someone");
    });

    it("deposit break vs wait (Aisha), in Arabic", async () => {
      const depositId = "dep_aisha_term12";
      const { body } = await compare({
        customerRef: persona("aisha").ref,
        scenario: "deposit_break_vs_wait",
        params: { depositId },
        locale: "ar",
      });
      const ev = engine("aisha", "deposit.break", { depositId });
      const [breakNow, wait] = body.options;
      expect(breakNow?.facts.find((f) => f.key === "amountReceived")?.value).toBe(
        v(ev, "netReceivedNow"),
      );
      expect(wait?.facts.find((f) => f.key === "amountReceived")?.value).toBe(
        v(ev, "netAtMaturity"),
      );
      expect(wait?.best).toBe(true);
      expect(body.headline).toBe("إبقاء هذه الوديعة حتى 9 أكتوبر 2026 يمنحك 9,012.33 ر.ق أكثر");
    });

    it("minimum vs custom payment (Ravi), with his own amount", async () => {
      const cardId = "card_ravi_gold";
      const { body } = await compare({
        customerRef: persona("ravi").ref,
        scenario: "min_vs_custom_payment",
        params: { cardId, paymentAmount: "2500.00" },
      });
      const ev = engine("ravi", "card.minimum_payment", { cardId, paymentAmount: "2500.00" });
      const get = (key: string, f: string) =>
        body.options.find((o) => o.key === key)?.facts.find((x) => x.key === f)?.value;
      expect(get("minimum", "totalCharges")).toBe(v(ev, "totalInterestMinimum"));
      expect(get("minimum", "monthsToClear")).toBe(v(ev, "monthsToClearMinimum"));
      expect(get("custom", "monthlyPayment")).toBe("2500.00");
      expect(get("custom", "totalCharges")).toBe(v(ev, "totalInterestComparison"));
      expect(get("full", "totalCharges")).toBe("0.00");
      expect(body.options.find((o) => o.best)?.key).toBe("full");
    });

    it("consent, missing params, other customers' products, and the pack kill switch", async () => {
      expect(
        (
          await compare({
            customerRef: persona("priya").ref,
            scenario: "min_vs_custom_payment",
            params: { cardId: "card_priya_classic" },
          })
        ).body.kind,
      ).toBe("generic");
      expect(
        (
          await compare({
            customerRef: persona("ravi").ref,
            scenario: "deposit_break_vs_wait",
            params: {},
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await compare({
            customerRef: persona("ravi").ref,
            scenario: "deposit_break_vs_wait",
            params: { depositId: "dep_aisha_term12" },
          })
        ).status,
      ).toBe(404);
      await prisma.rulePack.updateMany({
        where: { key: "deposit.break" },
        data: { enabled: false },
      });
      try {
        const off = await compare({
          customerRef: persona("aisha").ref,
          scenario: "deposit_break_vs_wait",
          params: { depositId: "dep_aisha_term12" },
        });
        expect([off.status, off.body.kind, off.body.options]).toEqual([200, "none", []]);
      } finally {
        await prisma.rulePack.updateMany({
          where: { key: "deposit.break" },
          data: { enabled: true },
        });
      }
    });
  });

  describe("Ask AMIL", () => {
    it("Khalid: 'What happens if I close my card?' answered with fact chips, streamed over SSE", async () => {
      const r = await ask(persona("khalid").ref, "What happens if I close my card?", {
        locale: "en",
      });
      expect(r.status).toBe(200);
      const steps = r.events
        .filter((e) => e.event === "status")
        .map((e) => (e.data as { step: string }).step);
      expect(steps).toEqual([...GRAPH_STEPS]);
      expect(r.events.at(-1)?.event).toBe("done");
      expect(r.answer).toMatchObject({
        kind: "insight",
        intent: "card.close",
        severity: "critical",
      });
      expect(r.answer.headline).toBe("Closing this card forfeits 42,000 points (about QAR 420.00)");
      expect(r.answer.facts.find((f) => f.key === "pointsValue")).toMatchObject({
        display: "QAR 420.00",
        source: "rewards_ledger",
        asOf: "2026-09-30",
      });
      expect(r.answer.options[0]).toMatchObject({
        key: "redeem_points",
        deepLink: "ddb://cards/card_khalid_platinum/rewards",
      });
      expect(r.answer.aiDisclosure).toBe("Figures from Doha Demo Bank records as of 30 Sep 2026.");
      // The streamed text is exactly the validated answer.
      expect(r.text).toBe(`${r.answer.headline}\n\n${r.answer.body}`);

      // One audit event per turn, with the question, the intent and what was shown.
      const event = await prisma.insightEvent.findFirst({
        where: { rulePackKey: "assistant", trigger: "assistant" },
        orderBy: { seq: "desc" },
      });
      const shown = event?.shown as {
        question: string;
        intent: string;
        checks: string[];
        answer: { headline: string };
      };
      expect(shown.question).toBe("What happens if I close my card?");
      expect(shown.intent).toBe("card.close");
      expect(shown.checks).toEqual(["numbers_ok", "guard_ok"]);
      expect(shown.answer.headline).toBe(r.answer.headline);
      expect(event?.customerRefHash).not.toContain(persona("khalid").ref);
    });

    it("answers the same question in Arabic", async () => {
      const r = await ask(persona("khalid").ref, "ماذا يحدث إذا أغلقت بطاقتي؟", { locale: "ar" });
      expect(r.answer.headline).toBe("إغلاق هذه البطاقة يُفقدك 42,000 نقطة (نحو 420.00 ر.ق)");
      expect(r.answer.options[0]?.label).toBe("استبدل النقاط أولاً");
    });

    it("refuses investment advice, with Talk to someone and no customer figures", async () => {
      const r = await ask(persona("khalid").ref, "Should I invest in stocks or gold?");
      expect(r.answer).toMatchObject({
        kind: "refusal",
        intent: "refuse_advice",
        headline: "I can't give investment or product advice",
      });
      expect(r.answer.facts).toEqual([]);
      expect(r.answer.options.map((o) => o.key)).toEqual(["talk_to_someone"]);
      const ar = await ask(persona("khalid").ref, "هل تنصحني بالاستثمار في الأسهم؟", {
        locale: "ar",
      });
      expect(ar.answer.headline).toBe("لا أستطيع تقديم نصائح استثمارية أو توصيات بمنتجات");
    });

    it("refuses out-of-scope questions", async () => {
      const r = await ask(persona("khalid").ref, "What's the weather in Doha?");
      expect(r.answer).toMatchObject({ kind: "refusal", intent: "refuse_scope" });
    });

    it("compares settlement dates for Fatima, matching the compare view", async () => {
      const r = await ask(persona("fatima").ref, "When is the cheapest day to settle my finance?", {
        locale: "en",
      });
      expect(r.answer.kind).toBe("comparison");
      const cheapest = r.answer.comparison?.options.find((o) => o.key === "cheapest_date");
      expect(cheapest?.facts.find((f) => f.key === "savingVsToday")?.value).toBe("4000.00");
      expect(r.answer.headline).toMatch(/costs QAR 4,000\.00 less than today$/);
    });

    it("explains Ravi's latest charge and links to the full explanation", async () => {
      const r = await ask(persona("ravi").ref, "Why was I charged a fee?");
      expect(r.answer.kind).toBe("charge");
      const latest = await prisma.transaction.findFirst({
        where: { feeCode: { not: null }, card: { customerId: persona("ravi").id } },
        orderBy: [{ postedAt: "desc" }, { id: "asc" }],
      });
      expect(r.answer.options[0]).toMatchObject({
        key: "view_charge",
        deepLink: `ddb://charges/${latest?.id}`,
      });
      expect(r.answer.facts.find((f) => f.key === "chargeAmount")?.value).toBe(
        latest?.amount.toFixed(2),
      );
      expect(r.answer.details.length).toBeGreaterThan(0);
    });

    it("asks for an amount, then answers with the tapped suggestion", async () => {
      const first = await ask(
        persona("khalid").ref,
        "What does a cash withdrawal on my card cost?",
      );
      expect(first.answer.kind).toBe("clarify");
      const pick = first.answer.suggestions.find((s) => s.context?.amount === "1000.00");
      expect(pick).toBeDefined();
      const second = await ask(persona("khalid").ref, pick?.message ?? "", {
        context: pick?.context,
      });
      expect(second.answer).toMatchObject({ kind: "insight", intent: "card.cash_withdrawal" });
      expect(second.answer.headline).toBe(
        "A cash withdrawal of QAR 1,000.00 has a fee of QAR 60.00",
      );
    });

    it("answers rules questions from the bank's FAQ, with no figures", async () => {
      const r = await ask(persona("fatima").ref, "What is ibra?", { locale: "en" });
      expect(r.answer).toMatchObject({
        kind: "faq",
        headline: "What is ibra when I settle a murabaha early?",
      });
      expect(`${r.answer.body} ${r.answer.details.join(" ")}`).not.toMatch(/\d/);
      // An English question from a customer who reads Arabic gets the Arabic entry.
      const ar = await ask(persona("fatima").ref, "What is ibra?");
      expect(ar.answer.headline).toBe("ما هو الإبراء عند السداد المبكر للمرابحة؟");
    });

    it("needs the customer's consent before reading any product", async () => {
      const r = await ask(persona("priya").ref, "What happens if I close my card?");
      expect(r.answer).toMatchObject({ kind: "no_consent", facts: [] });
    });

    it("works with a widget session token; a session cannot ask about another customer", async () => {
      const session = await post("/v1/sessions", {
        customerRef: persona("khalid").ref,
        locale: "en",
      });
      const token = session.json<{ token: string }>().token;
      const res = await app.inject({
        method: "POST",
        url: "/v1/assistant/messages",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        payload: JSON.stringify({
          customerRef: persona("khalid").ref,
          message: "What products do I have?",
        }),
      });
      expect(res.headers["content-type"]).toContain("text/event-stream");
      expect(res.payload).toContain("event: answer");
      const other = await app.inject({
        method: "POST",
        url: "/v1/assistant/messages",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        payload: JSON.stringify({ customerRef: persona("fatima").ref, message: "hello" }),
      });
      expect([other.statusCode, other.json()]).toEqual([403, { error: "forbidden" }]);
    });

    it("the audit chain still verifies", async () => {
      expect((await verifyBankChain(prisma, "bank_ddb")).ok).toBe(true);
    });
  });
});
