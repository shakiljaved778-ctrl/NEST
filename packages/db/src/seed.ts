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
import { buildSeedData } from "./seed/build";
import { writeSeedData } from "./seed/write";

async function main(): Promise<void> {
  const now = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid SEED_NOW: ${process.env.SEED_NOW}`);
  const data = buildSeedData(now);
  const prisma = new PrismaClient();

  try {
    await writeSeedData(prisma, data);

    console.log(
      [
        `Seeded Doha Demo Bank (fictional) as of ${now.toISOString()}:`,
        `  customers ${data.customers.length}, consents ${data.consents.length}`,
        `  accounts ${data.accounts.length}, standing orders ${data.standingOrders.length}`,
        `  cards ${data.cards.length}, rewards ledgers ${data.rewardsLedgers.length}, instalment plans ${data.instalmentPlans.length}`,
        `  finance ${data.finances.length}, deposits ${data.deposits.length}`,
        `  transactions ${data.transactions.length}, fee schedule ${data.feeSchedule.length}`,
        `  rule packs ${data.rulePacks.length}, templates ${data.templates.length}`,
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
