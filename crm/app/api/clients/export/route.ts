import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAccounts, listB2cContacts, type ClientFilters } from "@/lib/services/clients";
import { logAudit } from "@/lib/audit";
import { toCsv } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const sp = new URL(req.url).searchParams;
  const filters: ClientFilters = {
    q: sp.get("q") ?? undefined,
    type: (sp.get("type") as ClientFilters["type"]) ?? "all",
    status: sp.get("status") ?? undefined,
    territory: sp.get("territory") ?? undefined,
    ownerId: sp.get("ownerId") ?? undefined,
  };

  const showAccounts = filters.type === "all" || filters.type === "account";
  const showContacts = filters.type === "all" || filters.type === "contact";
  const [accounts, contacts] = await Promise.all([
    showAccounts ? listAccounts(user, filters) : Promise.resolve([]),
    showContacts ? listB2cContacts(user, filters) : Promise.resolve([]),
  ]);

  await logAudit({
    action: "EXPORT", entityType: "ACCOUNT", actorId: user.id, actorEmail: user.email,
    after: { accounts: accounts.length, contacts: contacts.length },
  });

  const rows: unknown[][] = [
    ...accounts.map((a) => ["B2B", a.legalName, a.crNumber, a.industry, a.status, a.territory, a.owner?.name, a._count.subscriptions, a.createdAt.toISOString()]),
    ...contacts.map((c) => ["B2C", `${c.firstName} ${c.lastName}`, "", c.nationality, c.clientStatus, "", c.owner?.name, c._count.subscriptions, c.createdAt.toISOString()]),
  ];

  const csv = toCsv(["Type", "Name", "CR number", "Industry/Nationality", "Status", "Territory", "Owner", "Subscriptions", "Created (UTC)"], rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
