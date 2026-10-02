import type { PrismaClient } from "@prisma/client";
import { encryptRow, keyProviderFromEnv, type PiiKeyProvider } from "../pii";
import { BANK_ID } from "./bank";
import type { SeedData } from "./build";

/**
 * Write the synthetic dataset (D-003): upsert the bank and console users, replace demo product
 * data, never touch the append-only audit tables. PII columns are encrypted before they are
 * written (D-066).
 */
export async function writeSeedData(
  prisma: PrismaClient,
  data: SeedData,
  keys: PiiKeyProvider = keyProviderFromEnv(),
): Promise<void> {
  const customers = data.customers.map((r) => encryptRow(keys, "customer", r));
  const accounts = data.accounts.map((r) => encryptRow(keys, "account", r));
  const cards = data.cards.map((r) => encryptRow(keys, "card", r));
  await prisma.$transaction(
    async (tx) => {
      const { id: _id, ...bankUpdate } = data.bank;
      await tx.bank.upsert({ where: { id: BANK_ID }, create: data.bank, update: bankUpdate });

      await tx.customer.deleteMany({ where: { bankId: BANK_ID } });
      await tx.feeSchedule.deleteMany({ where: { bankId: BANK_ID } });
      await tx.proactiveJob.deleteMany({ where: { bankId: BANK_ID } });
      await tx.rulePack.deleteMany({ where: { bankId: BANK_ID } });
      await tx.template.deleteMany({ where: { bankId: BANK_ID } });

      for (const u of data.consoleUsers) {
        const { id, ...rest } = u;
        await tx.consoleUser.upsert({ where: { id }, create: u, update: rest });
      }
      await tx.proactiveJob.createMany({ data: data.proactiveJobs });
      await tx.feeSchedule.createMany({ data: data.feeSchedule });
      await tx.customer.createMany({ data: customers });
      await tx.consent.createMany({ data: data.consents });
      await tx.account.createMany({ data: accounts });
      await tx.standingOrder.createMany({ data: data.standingOrders });
      await tx.card.createMany({ data: cards });
      await tx.rewardsLedger.createMany({ data: data.rewardsLedgers });
      await tx.instalmentPlan.createMany({ data: data.instalmentPlans });
      await tx.finance.createMany({ data: data.finances });
      await tx.deposit.createMany({ data: data.deposits });
      await tx.transaction.createMany({ data: data.transactions });
      await tx.rulePack.createMany({ data: data.rulePacks });
      await tx.template.createMany({ data: data.templates });
    },
    { timeout: 60_000 },
  );
}
