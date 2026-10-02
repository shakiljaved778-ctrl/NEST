import type { PrismaClient } from "@prisma/client";
import { decryptPii, encryptPii, PII_COLUMNS, type PiiKeyProvider, type PiiTable } from "./pii";

/**
 * Re-encrypt every PII value that is not under the current key (D-066). Run after adding a new
 * key in front of PII_ENCRYPTION_KEYS; once it reports nothing left, the old key can be removed.
 */
export async function reencryptPii(
  prisma: PrismaClient,
  keys: PiiKeyProvider,
): Promise<Record<PiiTable, number>> {
  const current = `enc:v1:${keys.currentKeyId}:`;
  const counts: Record<PiiTable, number> = { customer: 0, account: 0, card: 0 };
  const rewrite = (table: PiiTable, row: Record<string, unknown> & { id: string }) => {
    const data: Record<string, string> = {};
    for (const column of PII_COLUMNS[table]) {
      const v = row[column];
      if (typeof v === "string" && !v.startsWith(current))
        data[column] = encryptPii(
          keys,
          table,
          column,
          row.id,
          decryptPii(keys, table, column, row.id, v),
        );
    }
    return Object.keys(data).length ? data : null;
  };
  await prisma.$transaction(
    async (tx) => {
      for (const row of await tx.customer.findMany()) {
        const data = rewrite("customer", row);
        if (data) {
          await tx.customer.update({ where: { id: row.id }, data });
          counts.customer++;
        }
      }
      for (const row of await tx.account.findMany()) {
        const data = rewrite("account", row);
        if (data) {
          await tx.account.update({ where: { id: row.id }, data });
          counts.account++;
        }
      }
      for (const row of await tx.card.findMany()) {
        const data = rewrite("card", row);
        if (data) {
          await tx.card.update({ where: { id: row.id }, data });
          counts.card++;
        }
      }
    },
    { timeout: 120_000 },
  );
  return counts;
}
