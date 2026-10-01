import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import {
  appendInsightEvent,
  type AuditEventContent,
  canonicalJson,
  computeEventHash,
  GENESIS_HASH,
  hashCustomerRef,
  type StoredEvent,
  verifyBankChain,
  verifyChain,
} from "./audit";

function content(i: number, bankId = "bank_chain_unit"): AuditEventContent {
  return {
    id: `evt_${i}`,
    bankId,
    occurredAt: new Date(Date.UTC(2026, 8, 30, 9, 0, i)),
    trigger: "action:card.close",
    customerRefHash: "h",
    rulePackKey: "card.close",
    rulePackVersion: "1.0.0",
    variant: "conventional",
    inputSnapshotHash: "x",
    applicable: true,
    severity: "critical",
    facts: { pointsValue: { value: "420.00", unit: "QAR" } },
    templateKey: "card.close.conventional.critical",
    templateVersion: 1,
    modelProvider: "mock",
    modelVersion: "mock-wording-1",
    validatorResult: "passed",
    locale: "en",
    shown: { headline: "h", body: "b" },
    latencyMs: 12,
    retentionUntil: new Date(Date.UTC(2036, 8, 30)),
  };
}

function chain(n: number): StoredEvent[] {
  const out: StoredEvent[] = [];
  let prev = GENESIS_HASH;
  for (let i = 0; i < n; i++) {
    const c = content(i);
    const hash = computeEventHash(prev, c);
    out.push({ ...c, seq: BigInt(i + 1), prevHash: prev, hash });
    prev = hash;
  }
  return out;
}

describe("canonicalJson", () => {
  it("is independent of key order and stable for dates", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [2, { x: 2, y: 1 }] }, b: 1 }),
    );
    expect(canonicalJson({ at: new Date("2026-09-30T09:00:00Z") })).toBe(
      '{"at":"2026-09-30T09:00:00.000Z"}',
    );
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

describe("hashCustomerRef", () => {
  it("is keyed and bank-scoped; the raw ref never appears", () => {
    const h = hashCustomerRef("secret", "bank_ddb", "DDB-C-0001");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(hashCustomerRef("other-secret", "bank_ddb", "DDB-C-0001"));
    expect(h).not.toBe(hashCustomerRef("secret", "bank_other", "DDB-C-0001"));
  });
});

describe("verifyChain (pure)", () => {
  it("verifies an intact chain", () => {
    expect(verifyChain(chain(5))).toEqual({
      ok: true,
      checked: 5,
      firstBrokenSeq: null,
      reason: null,
    });
  });

  it("detects an edited fact", () => {
    const c = chain(5);
    const e = c[2];
    if (!e) throw new Error();
    c[2] = { ...e, facts: { pointsValue: { value: "42.00", unit: "QAR" } } };
    expect(verifyChain(c)).toMatchObject({
      ok: false,
      firstBrokenSeq: 3n,
      reason: "hash_mismatch",
    });
  });

  it("detects edited wording shown to the customer", () => {
    const c = chain(3);
    const e = c[1];
    if (!e) throw new Error();
    c[1] = { ...e, shown: { headline: "something else", body: "b" } };
    expect(verifyChain(c).reason).toBe("hash_mismatch");
  });

  it("detects a deleted event", () => {
    const c = chain(5);
    c.splice(2, 1);
    expect(verifyChain(c)).toMatchObject({ ok: false, firstBrokenSeq: 4n, reason: "broken_link" });
  });

  it("detects a re-computed (forged) hash further down the chain", () => {
    const c = chain(4);
    const e = c[1];
    if (!e) throw new Error();
    const forged = { ...e, severity: "info" as const };
    c[1] = {
      ...forged,
      hash: computeEventHash(forged.prevHash, {
        ...forged,
        seq: undefined,
        prevHash: undefined,
        hash: undefined,
      } as never),
    };
    expect(verifyChain(c)).toMatchObject({ ok: false, firstBrokenSeq: 3n, reason: "broken_link" });
  });

  it("accepts a chain whose first event anchors on a purged predecessor", () => {
    expect(verifyChain(chain(5).slice(2)).ok).toBe(true);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("audit chain in PostgreSQL", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  afterAll(() => prisma.$disconnect());
  const bankId = `bank_chain_${randomUUID().slice(0, 8)}`;

  it("appends concurrently without forking, and the chain verifies", async () => {
    await prisma.bank.create({
      data: {
        id: bankId,
        name: "Chain Test Bank (fictional)",
        nameAr: "بنك",
        supportedLocales: ["en"],
        brandTokens: {},
        deepLinkScheme: "test://",
        severityThresholds: {},
      },
    });
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        appendInsightEvent(prisma, { ...content(i, bankId), id: randomUUID() }),
      ),
    );
    expect(await verifyBankChain(prisma, bankId)).toMatchObject({ ok: true, checked: 25 });
  });

  it("detects tampering even by a superuser who bypasses the append-only trigger", async () => {
    let verdict: unknown;
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'ALTER TABLE "insight_event" DISABLE TRIGGER insight_event_append_only',
        );
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "insight_event" SET "facts" = '{"pointsValue":{"value":"1.00","unit":"QAR"}}' WHERE "id" = (SELECT "id" FROM "insight_event" WHERE "bankId" = '${bankId}' ORDER BY "seq" OFFSET 3 LIMIT 1)`,
        );
        expect(updated).toBe(1);
        verdict = await verifyBankChain(tx, bankId);
        throw new Error("rollback"); // leave the test database untouched
      }),
    ).rejects.toThrow("rollback");
    expect(verdict).toMatchObject({ ok: false, reason: "hash_mismatch" });
    expect(await verifyBankChain(prisma, bankId)).toMatchObject({ ok: true });
  });
});
