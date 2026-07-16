import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLead, findDuplicateLeads } from "@/lib/services/leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/entity/timeline";
import { TasksCard } from "@/components/entity/tasks-card";
import { DocumentsCard } from "@/components/entity/documents-card";
import { QuickActions } from "@/components/entity/quick-actions";
import { LeadStatusBadge, SlaCell } from "@/components/leads/lead-table";
import { LeadDetailActions } from "@/components/leads/lead-detail-actions";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await getLead(user, id);
  if (!lead) notFound();

  const readOnly = user.role === "READ_ONLY";
  const path = `/leads/${lead.id}`;

  const [accounts, products, owners, dups] = await Promise.all([
    db.account.findMany({ where: { deletedAt: null }, select: { id: true, legalName: true }, orderBy: { legalName: "asc" }, take: 200 }),
    db.product.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ["REP", "TEAM_LEAD", "MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    findDuplicateLeads(lead.email, lead.phone, lead.id),
  ]);

  const info: [string, React.ReactNode][] = [
    ["Email", lead.email ?? "—"],
    ["Phone", lead.phone ?? "—"],
    ["Company", lead.company ?? "—"],
    ["Source", `${lead.source}${lead.channel ? ` / ${lead.channel}` : ""}`],
    ["Campaign", lead.campaign ?? "—"],
    ["Territory", lead.territory ?? "—"],
    ["Product interest", lead.productInterest?.name ?? "—"],
    ["Score", String(lead.score)],
    ["Owner", lead.owner?.name ?? "Unassigned"],
    ["Team", lead.team?.name ?? "—"],
    ["Created", fmtDateTime(lead.createdAt)],
    ["First touch", lead.firstTouchAt ? fmtDateTime(lead.firstTouchAt) : "not yet"],
    ["Consent (PDPPL)", lead.lawfulBasis ? `${lead.lawfulBasis} · ${fmtDateTime(lead.consentAt)}` : "not recorded"],
  ];
  if (lead.status === "DISQUALIFIED") info.push(["Disqualify reason", lead.disqualifyReason ?? "—"]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leads" aria-label="Back to leads">
            <ArrowLeft className="rtl-flip" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {lead.firstName} {lead.lastName}
        </h1>
        <LeadStatusBadge status={lead.status} />
        <SlaCell
          lead={{
            status: lead.status,
            slaDueAt: lead.slaDueAt?.toISOString() ?? null,
            firstTouchAt: lead.firstTouchAt?.toISOString() ?? null,
            slaBreachedAt: lead.slaBreachedAt?.toISOString() ?? null,
          }}
        />
        <div className="ms-auto">
          <LeadDetailActions
            lead={{
              id: lead.id,
              status: lead.status,
              firstName: lead.firstName,
              lastName: lead.lastName,
              company: lead.company,
              convertedAccountId: lead.convertedAccountId,
              convertedContactId: lead.convertedContactId,
              convertedDealId: lead.convertedDealId,
            }}
            accounts={accounts}
            products={products}
            owners={owners}
            duplicates={dups}
            readOnly={readOnly}
            canReassign={user.role !== "REP" && !readOnly}
          />
        </div>
      </div>

      {lead.status === "CONVERTED" && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          Converted{" "}
          {lead.convertedAccount && (
            <>
              → Account{" "}
              <Link className="font-medium underline" href={`/clients/accounts/${lead.convertedAccount.id}`}>
                {lead.convertedAccount.legalName}
              </Link>
            </>
          )}
          {lead.convertedContact && (
            <>
              {" "}· Contact{" "}
              <Link className="font-medium underline" href={`/clients/contacts/${lead.convertedContact.id}`}>
                {lead.convertedContact.firstName} {lead.convertedContact.lastName}
              </Link>
            </>
          )}
          {lead.convertedDealId && (
            <>
              {" "}· <Link className="font-medium underline" href={`/deals/${lead.convertedDealId}`}>Deal</Link>
            </>
          )}
        </div>
      )}

      <QuickActions link={{ leadId: lead.id }} path={path} readOnly={readOnly} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ActivityTimeline
            activities={lead.activities.map((a) => ({
              id: a.id,
              type: a.type,
              subject: a.subject,
              body: a.body,
              occurredAt: a.occurredAt,
              userName: a.user.name,
            }))}
          />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {info.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-end font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {lead.notes && (
                <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm text-muted-foreground">{lead.notes}</p>
              )}
            </CardContent>
          </Card>
          <TasksCard
            tasks={lead.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              dueAt: t.dueAt.toISOString(),
              priority: t.priority,
              status: t.status,
              ownerName: t.owner.name,
            }))}
            path={path}
            readOnly={readOnly}
          />
          <DocumentsCard
            documents={lead.documents.map((d) => ({
              id: d.id,
              name: d.name,
              category: d.category,
              mime: d.mime,
              size: d.size,
              version: d.version,
              uploadedByName: d.uploadedBy.name,
              updatedAt: d.updatedAt.toISOString(),
            }))}
            link={{ leadId: lead.id }}
            path={path}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
