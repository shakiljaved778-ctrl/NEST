import Link from "next/link";
import { Building2, User } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listAccounts, listB2cContacts, type ClientFilters } from "@/lib/services/clients";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClientFiltersBar } from "@/components/clients/client-filters";
import { NewClientDialog } from "@/components/clients/new-client-dialog";
import { ExportButton } from "@/components/export-button";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT = { ACTIVE: "success", PROSPECT: "info", CHURNED: "secondary" } as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters: ClientFilters = {
    q: sp.q,
    type: (sp.type as ClientFilters["type"]) ?? "all",
    status: sp.status,
    territory: sp.territory,
    ownerId: sp.ownerId,
  };

  const showAccounts = filters.type === "all" || filters.type === "account";
  const showContacts = filters.type === "all" || filters.type === "contact";

  const [accounts, contacts, owners, accountOptions] = await Promise.all([
    showAccounts ? listAccounts(user, filters) : Promise.resolve([]),
    showContacts ? listB2cContacts(user, filters) : Promise.resolve([]),
    db.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ["REP", "TEAM_LEAD", "MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.account.findMany({ where: { deletedAt: null }, select: { id: true, legalName: true }, orderBy: { legalName: "asc" }, take: 500 }),
  ]);

  type Row =
    | { kind: "account"; id: string; name: string; sub: string; status: string; owner: string; territory: string; counts: string; created: Date }
    | { kind: "contact"; id: string; name: string; sub: string; status: string; owner: string; territory: string; counts: string; created: Date };

  const rows: Row[] = [
    ...accounts.map((a) => ({
      kind: "account" as const,
      id: a.id,
      name: a.legalName,
      sub: a.industry ?? a.crNumber ?? "—",
      status: a.status,
      owner: a.owner?.name ?? "—",
      territory: a.territory ?? "—",
      counts: `${a._count.contacts} contacts · ${a._count.deals} deals · ${a._count.subscriptions} subs`,
      created: a.createdAt,
    })),
    ...contacts.map((c) => ({
      kind: "contact" as const,
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      sub: c.email ?? c.phone ?? "—",
      status: c.clientStatus ?? "PROSPECT",
      owner: c.owner?.name ?? "—",
      territory: c.nationality ?? "—",
      counts: `${c._count.subscriptions} subs`,
      created: c.createdAt,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <div className="flex gap-2">
          <ExportButton href={`/api/clients/export?${new URLSearchParams(sp as Record<string, string>).toString()}`} />
          <NewClientDialog accounts={accountOptions} owners={owners} readOnly={user.role === "READ_ONLY"} />
        </div>
      </div>

      <ClientFiltersBar owners={owners} />

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Portfolio</TableHead>
              <TableHead>Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No clients match these filters
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={`${r.kind}-${r.id}`}>
                <TableCell>
                  <Link
                    href={r.kind === "account" ? `/clients/accounts/${r.id}` : `/clients/contacts/${r.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.sub}</div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {r.kind === "account" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {r.kind === "account" ? "B2B" : "B2C"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.territory}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status as keyof typeof STATUS_VARIANT] ?? "secondary"}>{r.status}</Badge>
                </TableCell>
                <TableCell>{r.owner}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.counts}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(r.created)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
