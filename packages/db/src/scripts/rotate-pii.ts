/**
 * `pnpm db:rotate-pii`: re-encrypt PII under the first key in PII_ENCRYPTION_KEYS (D-066).
 */
import { PrismaClient } from "@prisma/client";
import { keyProviderFromEnv } from "../pii";
import { reencryptPii } from "../pii-rotate";

const prisma = new PrismaClient();
try {
  const keys = keyProviderFromEnv();
  const counts = await reencryptPii(prisma, keys);
  console.log(
    `Re-encrypted under ${keys.currentKeyId}: ${counts.customer} customers, ` +
      `${counts.account} accounts, ${counts.card} cards`,
  );
} finally {
  await prisma.$disconnect();
}
