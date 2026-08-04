import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/rbac";
import { leadScope, accountScope, contactScope, dealScope } from "@/lib/rbac";
import { toTsQuery } from "@/lib/fts";

export { toTsQuery };

export type SearchResult = {
  type: "lead" | "account" | "contact" | "deal";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

// Global search uses Postgres full-text search over expression GIN indexes
// (created by scripts/fts.sql). Raw SQL returns candidate ids ranked by
// ts_rank; the final fetch re-applies RBAC scope through Prisma.
export async function globalSearch(user: SessionUser, q: string, limitPerType = 5): Promise<SearchResult[]> {
  const tsquery = toTsQuery(q);
  if (!tsquery) return [];

  const [leadIds, accountIds, contactIds, dealIds] = await Promise.all([
    db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "Lead"
      WHERE "deletedAt" IS NULL AND to_tsvector('simple',
        coalesce("firstName",'') || ' ' || coalesce("lastName",'') || ' ' ||
        coalesce(company,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,''))
        @@ to_tsquery('simple', ${tsquery})
      LIMIT 25`),
    db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "Account"
      WHERE "deletedAt" IS NULL AND to_tsvector('simple',
        coalesce("legalName",'') || ' ' || coalesce("tradeName",'') || ' ' ||
        coalesce("crNumber",'') || ' ' || coalesce(website,''))
        @@ to_tsquery('simple', ${tsquery})
      LIMIT 25`),
    db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "Contact"
      WHERE "deletedAt" IS NULL AND to_tsvector('simple',
        coalesce("firstName",'') || ' ' || coalesce("lastName",'') || ' ' ||
        coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(position,''))
        @@ to_tsquery('simple', ${tsquery})
      LIMIT 25`),
    db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "Deal"
      WHERE "deletedAt" IS NULL AND to_tsvector('simple', coalesce(name,''))
        @@ to_tsquery('simple', ${tsquery})
      LIMIT 25`),
  ]);

  const [leads, accounts, contacts, deals] = await Promise.all([
    db.lead.findMany({
      where: { id: { in: leadIds.map((r) => r.id) }, deletedAt: null, ...(await leadScope(user)) },
      select: { id: true, firstName: true, lastName: true, company: true, email: true, status: true },
      take: limitPerType,
    }),
    db.account.findMany({
      where: { id: { in: accountIds.map((r) => r.id) }, deletedAt: null, ...(await accountScope(user)) },
      select: { id: true, legalName: true, industry: true, status: true },
      take: limitPerType,
    }),
    db.contact.findMany({
      where: { id: { in: contactIds.map((r) => r.id) }, deletedAt: null, ...(await contactScope(user)) },
      select: { id: true, firstName: true, lastName: true, email: true, account: { select: { legalName: true } } },
      take: limitPerType,
    }),
    db.deal.findMany({
      where: { id: { in: dealIds.map((r) => r.id) }, deletedAt: null, ...(await dealScope(user)) },
      select: { id: true, name: true, value: true, currency: true, stage: { select: { name: true } } },
      take: limitPerType,
    }),
  ]);

  return [
    ...leads.map((l) => ({
      type: "lead" as const,
      id: l.id,
      title: `${l.firstName} ${l.lastName}`,
      subtitle: l.company ?? l.email ?? l.status,
      href: `/leads/${l.id}`,
    })),
    ...accounts.map((a) => ({
      type: "account" as const,
      id: a.id,
      title: a.legalName,
      subtitle: a.industry ?? a.status,
      href: `/clients/accounts/${a.id}`,
    })),
    ...contacts.map((c) => ({
      type: "contact" as const,
      id: c.id,
      title: `${c.firstName} ${c.lastName}`,
      subtitle: c.account?.legalName ?? c.email,
      href: `/clients/contacts/${c.id}`,
    })),
    ...deals.map((d) => ({
      type: "deal" as const,
      id: d.id,
      title: d.name,
      subtitle: d.stage.name,
      href: `/deals/${d.id}`,
    })),
  ];
}
