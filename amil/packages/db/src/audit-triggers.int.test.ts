/**
 * Integration test: audit tables are append-only at the DB level (non-negotiable 7, D-005).
 * Runs against TEST_DATABASE_URL (migrated in globalSetup); skipped when it is not set.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("audit tables are append-only", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  afterAll(() => prisma.$disconnect());

  async function insertEvent(retentionUntil: Date) {
    await prisma.bank.upsert({
      where: { id: "bank_test" },
      update: {},
      create: {
        id: "bank_test",
        name: "Test Bank (fictional)",
        nameAr: "بنك الاختبار",
        supportedLocales: ["en"],
        brandTokens: {},
        deepLinkScheme: "test://",
        severityThresholds: {},
      },
    });
    const id = randomUUID();
    return prisma.insightEvent.create({
      data: {
        id,
        bankId: "bank_test",
        trigger: "test",
        customerRefHash: "hash",
        rulePackKey: "card.close",
        rulePackVersion: "0.0.0",
        variant: "conventional",
        inputSnapshotHash: "x",
        applicable: false,
        facts: {},
        validatorResult: "not_used",
        locale: "en",
        shown: {},
        retentionUntil,
        prevHash: "0",
        hash: `h-${id}`,
      },
    });
  }
  const future = () => new Date(Date.now() + 86_400_000 * 365);
  const past = () => new Date(Date.now() - 86_400_000);

  it("rejects UPDATE", async () => {
    const e = await insertEvent(future());
    await expect(
      prisma.insightEvent.update({ where: { id: e.id }, data: { trigger: "tampered" } }),
    ).rejects.toThrow(/append-only/);
  });

  it("rejects DELETE, even for expired rows, without the purge flag", async () => {
    const e = await insertEvent(past());
    await expect(prisma.insightEvent.delete({ where: { id: e.id } })).rejects.toThrow(
      /append-only/,
    );
  });

  it("rejects TRUNCATE", async () => {
    await expect(prisma.$executeRawUnsafe('TRUNCATE "insight_event" CASCADE')).rejects.toThrow(
      /append-only/,
    );
  });

  it("rejects UPDATE and DELETE on customer_response", async () => {
    const e = await insertEvent(future());
    const r = await prisma.customerResponse.create({
      data: { insightEventId: e.id, action: "continued" },
    });
    await expect(
      prisma.customerResponse.update({ where: { id: r.id }, data: { action: "dismissed" } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.customerResponse.delete({ where: { id: r.id } })).rejects.toThrow(
      /append-only/,
    );
  });

  it("retention purge deletes only expired rows", async () => {
    const expired = await insertEvent(past());
    const live = await insertEvent(future());
    await prisma.customerResponse.create({
      data: { insightEventId: expired.id, action: "dismissed" },
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL amil.audit_purge = 'on'");
      await tx.customerResponse.deleteMany({ where: { insightEventId: expired.id } });
      await tx.insightEvent.delete({ where: { id: expired.id } });
    });
    expect(await prisma.insightEvent.findUnique({ where: { id: expired.id } })).toBeNull();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL amil.audit_purge = 'on'");
        await tx.insightEvent.delete({ where: { id: live.id } });
      }),
    ).rejects.toThrow(/append-only/);
  });
});
