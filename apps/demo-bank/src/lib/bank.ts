import "server-only";
import { getPrisma } from "@amil/db/client";
import { decryptRow, keyProviderFromEnv, type PiiKeyProvider } from "@amil/db/pii";
import { notFound } from "next/navigation";
import { BANK_ID } from "./constants";
import { DEMO_AMOUNTS } from "./demo";
import { currentPersonaKey } from "./persona";

let keys: PiiKeyProvider | undefined;
/** The bank's PII key provider (D-066): its records hold names, numbers and contacts encrypted. */
const piiKeys = () => (keys ??= keyProviderFromEnv());

/**
 * The demo bank's own backend: it reads its own (synthetic) core-banking records. AMIL is a
 * separate service, called over HTTP (see lib/amil.ts).
 */
export async function currentCustomer() {
  const prisma = getPrisma();
  const personaKey = await currentPersonaKey();
  const customer = await prisma.customer.findUnique({
    where: { bankId_personaKey: { bankId: BANK_ID, personaKey } },
    include: {
      accounts: { orderBy: { kind: "asc" } },
      cards: {
        where: { status: "active" },
        include: { rewards: true, instalmentPlans: { where: { status: "active" } } },
      },
      finances: { where: { status: "active" } },
      deposits: { where: { status: "active" } },
    },
  });
  if (!customer) notFound();
  const k = piiKeys();
  return {
    ...decryptRow(k, "customer", customer),
    accounts: customer.accounts.map((a) => decryptRow(k, "account", a)),
    cards: customer.cards.map((c) => decryptRow(k, "card", c)),
  };
}

export type CurrentCustomer = Awaited<ReturnType<typeof currentCustomer>>;

export async function listPersonas() {
  const rows = await getPrisma().customer.findMany({
    where: { bankId: BANK_ID },
    select: {
      id: true,
      personaKey: true,
      displayName: true,
      displayNameAr: true,
      segment: true,
      externalRef: true,
    },
    orderBy: { externalRef: "asc" },
  });
  return rows.map((r) => decryptRow(piiKeys(), "customer", r));
}

export async function bankBrand() {
  return getPrisma().bank.findUnique({
    where: { id: BANK_ID },
    select: { name: true, nameAr: true, brandTokens: true, digitStyle: true },
  });
}

export function cardOf(customer: CurrentCustomer, cardId: string) {
  const card = customer.cards.find((c) => c.id === cardId);
  if (!card) notFound();
  return card;
}

export function financeOf(customer: CurrentCustomer, financeId: string) {
  const finance = customer.finances.find((f) => f.id === financeId);
  if (!finance) notFound();
  return finance;
}

export function depositOf(customer: CurrentCustomer, depositId: string) {
  const deposit = customer.deposits.find((d) => d.id === depositId);
  if (!deposit) notFound();
  return deposit;
}

export function accountOf(customer: CurrentCustomer, accountId: string) {
  const account = customer.accounts.find((a) => a.id === accountId && a.status !== "closed");
  if (!account) notFound();
  return account;
}

/** Recent statement lines of one of the customer's cards or accounts, newest first. */
export async function statementLines(owner: { cardId: string } | { accountId: string }, take = 40) {
  return getPrisma().transaction.findMany({
    where: owner,
    orderBy: [{ postedAt: "desc" }, { id: "asc" }],
    take,
    select: {
      id: true,
      amount: true,
      direction: true,
      type: true,
      merchant: true,
      postedAt: true,
      feeCode: true,
    },
  });
}

export type StatementLine = Awaited<ReturnType<typeof statementLines>>[number];

export async function standingOrdersOf(accountId: string) {
  return getPrisma().standingOrder.findMany({
    where: { accountId, active: true },
    orderBy: { nextRunAt: "asc" },
  });
}

/** The customer's own transaction (for the charge explanation screen). */
export async function transactionOf(customer: CurrentCustomer, transactionId: string) {
  const txn = await getPrisma().transaction.findFirst({
    where: {
      id: transactionId,
      OR: [{ card: { customerId: customer.id } }, { account: { customerId: customer.id } }],
    },
    select: { id: true, cardId: true, accountId: true, merchant: true, postedAt: true },
  });
  if (!txn) notFound();
  return txn;
}

/** The card's largest purchase eligible for instalments (the demo's "convert" example). */
export async function largestRecentPurchase(cardId: string) {
  return getPrisma().transaction.findFirst({
    where: {
      cardId,
      type: "purchase",
      direction: "debit",
      amount: { gte: DEMO_AMOUNTS.eppMinPurchase },
    },
    orderBy: [{ amount: "desc" }, { id: "asc" }],
    select: { id: true, amount: true, merchant: true },
  });
}
