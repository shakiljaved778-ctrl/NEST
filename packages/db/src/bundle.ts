import type { PrismaClient } from "@prisma/client";
import type { CustomerBundle } from "./pack-inputs";
import type { SeedData } from "./seed/build";

/** A customer's product rows from the database, with only the transaction a check refers to. */
export async function loadCustomerBundle(
  prisma: PrismaClient,
  customerId: string,
  transactionId?: string,
): Promise<CustomerBundle | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      accounts: { include: { standingOrders: true } },
      cards: { include: { rewards: true, instalmentPlans: true } },
      finances: true,
      deposits: true,
    },
  });
  if (!customer) return null;
  const transactions = transactionId
    ? await prisma.transaction.findMany({
        where: { id: transactionId, card: { customerId } },
        select: { id: true, cardId: true, amount: true, type: true, direction: true },
      })
    : [];
  return {
    salaryTransfer: customer.salaryTransfer,
    accounts: customer.accounts,
    cards: customer.cards,
    finances: customer.finances,
    deposits: customer.deposits,
    transactions,
  };
}

/** The same bundle from the seed's create inputs (tests, no database). */
export function bundleFromSeed(data: SeedData, customerId: string): CustomerBundle {
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) throw new Error(`No seeded customer ${customerId}`);
  const cards = data.cards.filter((c) => c.customerId === customerId);
  const cardIds = new Set(cards.map((c) => c.id));
  return {
    salaryTransfer: customer.salaryTransfer ?? false,
    accounts: data.accounts
      .filter((a) => a.customerId === customerId)
      .map((a) => ({
        ...a,
        variant: a.variant ?? "conventional",
        standingOrders: data.standingOrders.filter((o) => o.accountId === a.id),
      })),
    cards: cards.map((c) => ({
      ...c,
      rewards: data.rewardsLedgers.find((r) => r.cardId === c.id) ?? null,
      instalmentPlans: data.instalmentPlans.filter((p) => p.cardId === c.id),
    })),
    finances: data.finances.filter((f) => f.customerId === customerId),
    deposits: data.deposits.filter((d) => d.customerId === customerId),
    transactions: data.transactions
      .filter((t) => t.cardId && cardIds.has(t.cardId))
      .map((t) => ({ ...t, id: t.id ?? "" })),
  };
}
