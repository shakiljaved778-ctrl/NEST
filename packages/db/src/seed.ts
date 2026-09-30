/**
 * `pnpm db:seed`: writes the synthetic Doha Demo Bank dataset.
 *
 * Idempotent (D-003): upserts the bank and console users, then replaces all demo product data
 * (customers cascade to consents, accounts, cards, finance, deposits, transactions, alerts).
 * It never touches the append-only audit tables (insight_event, customer_response).
 *
 * Dates are relative to SEED_NOW (ISO) or the current time (D-002).
 */
import { PrismaClient } from "@prisma/client";
import { BANK_ID } from "./seed/bank";
import { buildSeedData } from "./seed/build";

async function main(): Promise<void> {
  const now = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid SEED_NOW: ${process.env.SEED_NOW}`);
  const data = buildSeedData(now);
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(
      async (tx) => {
        const { id: _id, ...bankUpdate } = data.bank;
        await tx.bank.upsert({ where: { id: BANK_ID }, create: data.bank, update: bankUpdate });

        // Product data is replaced wholesale; audit tables are untouched.
        await tx.customer.deleteMany({ where: { bankId: BANK_ID } });
        await tx.feeSchedule.deleteMany({ where: { bankId: BANK_ID } });
        await tx.proactiveJob.deleteMany({ where: { bankId: BANK_ID } });

        for (const u of data.consoleUsers) {
          const { id, ...rest } = u;
          await tx.consoleUser.upsert({ where: { id }, create: u, update: rest });
        }
        await tx.proactiveJob.createMany({ data: data.proactiveJobs });
        await tx.feeSchedule.createMany({ data: data.feeSchedule });
        await tx.customer.createMany({ data: data.customers });
        await tx.consent.createMany({ data: data.consents });
        await tx.account.createMany({ data: data.accounts });
        await tx.standingOrder.createMany({ data: data.standingOrders });
        await tx.card.createMany({ data: data.cards });
        await tx.rewardsLedger.createMany({ data: data.rewardsLedgers });
        await tx.instalmentPlan.createMany({ data: data.instalmentPlans });
        await tx.finance.createMany({ data: data.finances });
        await tx.deposit.createMany({ data: data.deposits });
        await tx.transaction.createMany({ data: data.transactions });
      },
      { timeout: 60_000 },
    );

    console.log(
      [
        `Seeded Doha Demo Bank (fictional) as of ${now.toISOString()}:`,
        `  customers ${data.customers.length}, consents ${data.consents.length}`,
        `  accounts ${data.accounts.length}, standing orders ${data.standingOrders.length}`,
        `  cards ${data.cards.length}, rewards ledgers ${data.rewardsLedgers.length}, instalment plans ${data.instalmentPlans.length}`,
        `  finance ${data.finances.length}, deposits ${data.deposits.length}`,
        `  transactions ${data.transactions.length}, fee schedule ${data.feeSchedule.length}`,
        `  console users ${data.consoleUsers.length}`,
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
