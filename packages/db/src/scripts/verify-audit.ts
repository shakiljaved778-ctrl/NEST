/** `pnpm audit:verify [bankId]`: verify a bank's audit hash chain (non-negotiable 7). */
import { PrismaClient } from "@prisma/client";
import { verifyBankChain } from "../audit";

const bankId = process.argv[2] ?? "bank_ddb";
const prisma = new PrismaClient();
try {
  const result = await verifyBankChain(prisma, bankId);
  console.log(
    JSON.stringify({
      bankId,
      ...result,
      firstBrokenSeq: result.firstBrokenSeq?.toString() ?? null,
    }),
  );
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await prisma.$disconnect();
}
