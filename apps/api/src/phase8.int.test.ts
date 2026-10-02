/**
 * Phase 8 integration tests (TEST_DATABASE_URL): PII encrypted at rest, and the engine still works
 * on encrypted records because it never reads those columns.
 */
import { randomBytes } from "node:crypto";
import {
  decryptRow,
  keyProviderFromEnv,
  PrismaClient,
  reencryptPii,
  staticKeyProvider,
} from "@amil/db";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Phase 8: hardening (integration)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "" } } });
  afterAll(() => prisma.$disconnect());

  describe("PII encryption at rest (D-066)", () => {
    it("stores every PII column as AES-256-GCM ciphertext, never plaintext", async () => {
      const rows = await prisma.$queryRaw<{ v: string | null }[]>`
        SELECT "displayName" AS v FROM customer UNION ALL SELECT "displayNameAr" FROM customer
        UNION ALL SELECT phone FROM customer UNION ALL SELECT email FROM customer
        UNION ALL SELECT number FROM account UNION ALL SELECT iban FROM account
        UNION ALL SELECT pan FROM card`;
      const values = rows.map((r) => r.v).filter((v): v is string => v !== null);
      expect(values.length).toBeGreaterThan(100);
      for (const v of values) expect(v).toMatch(/^enc:v1:[\w-]+:[\w-]+:[\w-]+:[\w-]+$/);
      const all = values.join(" ");
      for (const plain of ["Khalid", "خالد", "+974", "@customers.ddb", "QA00DDBX"])
        expect(all).not.toContain(plain);
    });

    it("the bank's key decrypts its own records", async () => {
      const khalid = await prisma.customer.findFirstOrThrow({
        where: { personaKey: "khalid" },
        include: { cards: true },
      });
      const keys = keyProviderFromEnv();
      expect(decryptRow(keys, "customer", khalid).displayName).toMatch(/^Khalid/);
      const card = khalid.cards[0];
      expect(card && decryptRow(keys, "card", card).pan).toMatch(/^0000\d{12}$/);
    });

    it("rotates: rows move to the new key and still decrypt; rotating back restores them", async () => {
      const demo = keyProviderFromEnv();
      const fresh = staticKeyProvider([
        ["rot2", randomBytes(32)],
        [demo.currentKeyId, demo.key(demo.currentKeyId)],
      ]);
      const moved = await reencryptPii(prisma, fresh);
      expect(moved.customer).toBe(25);
      const khalid = await prisma.customer.findFirstOrThrow({ where: { personaKey: "khalid" } });
      expect(khalid.displayName).toMatch(/^enc:v1:rot2:/);
      expect(decryptRow(fresh, "customer", khalid).displayName).toMatch(/^Khalid/);
      expect(await reencryptPii(prisma, fresh)).toEqual({ customer: 0, account: 0, card: 0 });
      const back = staticKeyProvider([
        [demo.currentKeyId, demo.key(demo.currentKeyId)],
        ["rot2", fresh.key("rot2")],
      ]);
      await reencryptPii(prisma, back);
      const again = await prisma.customer.findFirstOrThrow({ where: { personaKey: "khalid" } });
      expect(decryptRow(demo, "customer", again).displayName).toMatch(/^Khalid/);
    });
  });
});
