import "server-only";
import { getPrisma } from "@amil/db/client";
import { notFound } from "next/navigation";
import { BANK_ID } from "./constants";
import { currentPersonaKey } from "./persona";

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
  return customer;
}

export type CurrentCustomer = Awaited<ReturnType<typeof currentCustomer>>;

export async function listPersonas() {
  return getPrisma().customer.findMany({
    where: { bankId: BANK_ID },
    select: {
      personaKey: true,
      displayName: true,
      displayNameAr: true,
      segment: true,
      externalRef: true,
    },
    orderBy: { externalRef: "asc" },
  });
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
