import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getContact, getKycChecklist } from "@/lib/services/clients";
import { canAccessOwned, isManagerial } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/entity/timeline";
import { TasksCard } from "@/components/entity/tasks-card";
import { DocumentsCard } from "@/components/entity/documents-card";
import { QuickActions } from "@/components/entity/quick-actions";
import { KycChecklist } from "@/components/clients/kyc-checklist";
import { SubscriptionsCard } from "@/components/clients/subscriptions-card";
import { MaskedId } from "@/components/clients/masked-id";
import { EraseClientButton } from "@/components/clients/erase-client-button";
import { fmtDateTime, fmtMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = { ACTIVE: "success", PROSPECT: "info", CHURNED: "secondary" } as const;

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const contact = await getContact(user, id);
  if (!contact) notFound();

  const isB2C = !contact.accountId;
  const kyc = isB2C ? await getKycChecklist("contact", contact.id) : [];
  const readOnly = user.role === "READ_ONLY";
  const path = `/clients/contacts/${contact.id}`;
  const canReveal =
    isManagerial(user.role) || user.role === "READ_ONLY" || user.role === "TEAM_LEAD" ||
    (await canAccessOwned(user, contact));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients" aria-label="Back to clients">
            <ArrowLeft className="rtl-flip" />
          </Link>
        </Button>
        <User className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          {contact.firstName} {contact.lastName}
        </h1>
        {isB2C ? <Badge variant="outline">B2C individual</Badge> : <Badge variant="outline">Contact</Badge>}
        {contact.clientStatus && (
          <Badge variant={STATUS_VARIANT[contact.clientStatus]}>{contact.clientStatus}</Badge>
        )}
        {isManagerial(user.role) && (
          <div className="ms-auto flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/clients/contact/${contact.id}/export`} download>
                Export data (PDPPL)
              </a>
            </Button>
            {user.role === "ADMIN" && (
              <EraseClientButton clientType="contact" clientId={contact.id} name={`${contact.firstName} ${contact.lastName}`} />
            )}
          </div>
        )}
      </div>

      <QuickActions link={{ contactId: contact.id }} path={path} readOnly={readOnly} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {contact.account && (
                  <div className="col-span-2 flex justify-between">
                    <dt className="text-muted-foreground">Company</dt>
                    <dd>
                      <Link href={`/clients/accounts/${contact.account.id}`} className="text-primary hover:underline">
                        {contact.account.legalName}
                      </Link>
                    </dd>
                  </div>
                )}
                <div className="flex justify-between"><dt className="text-muted-foreground">Position</dt><dd>{contact.position ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{contact.owner?.name ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{contact.email ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd>{contact.phone ?? "—"}</dd></div>
                {contact.email2 && <div className="flex justify-between"><dt className="text-muted-foreground">Email 2</dt><dd>{contact.email2}</dd></div>}
                {contact.phone2 && <div className="flex justify-between"><dt className="text-muted-foreground">Phone 2</dt><dd>{contact.phone2}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">Nationality</dt><dd>{contact.nationality ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Language</dt><dd>{contact.preferredLanguage === "AR" ? "Arabic" : "English"}</dd></div>
                <div className="col-span-2 flex items-center justify-between">
                  <dt className="text-muted-foreground">{contact.idDocType ?? "ID"} number</dt>
                  <dd>
                    <MaskedId contactId={contact.id} last3={contact.nationalIdLast3} docType={contact.idDocType} canReveal={canReveal} />
                  </dd>
                </div>
                <div className="col-span-2 flex justify-between">
                  <dt className="text-muted-foreground">Consent (PDPPL)</dt>
                  <dd>{contact.lawfulBasis ? `${contact.lawfulBasis} · ${fmtDateTime(contact.consentAt)}` : "not recorded"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {contact.dealsPrimary.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Deals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {contact.dealsPrimary.map((d) => (
                  <div key={d.id} className="flex items-center justify-between">
                    <Link href={`/deals/${d.id}`} className="text-primary hover:underline">{d.name}</Link>
                    <span className="text-xs text-muted-foreground">{d.stage.name} · {fmtMoney(d.value, d.currency)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <ActivityTimeline
            activities={contact.activities.map((a) => ({
              id: a.id, type: a.type, subject: a.subject, body: a.body, occurredAt: a.occurredAt, userName: a.user.name,
            }))}
          />
        </div>

        <div className="space-y-4">
          <SubscriptionsCard
            subscriptions={contact.subscriptions.map((s) => ({
              id: s.id, productName: s.product.name, status: s.status,
              startDate: s.startDate.toISOString(), renewalDate: s.renewalDate?.toISOString() ?? null, mrrValue: s.mrrValue,
            }))}
          />
          {isB2C && <KycChecklist items={kyc} contactId={contact.id} readOnly={readOnly} />}
          <TasksCard
            tasks={contact.tasks.map((t) => ({
              id: t.id, title: t.title, dueAt: t.dueAt.toISOString(), priority: t.priority, status: t.status, ownerName: t.owner.name,
            }))}
            path={path}
            readOnly={readOnly}
          />
          <DocumentsCard
            documents={contact.documents.map((d) => ({
              id: d.id, name: d.name, category: d.category, mime: d.mime, size: d.size, version: d.version,
              uploadedByName: d.uploadedBy.name, updatedAt: d.updatedAt.toISOString(),
            }))}
            link={{ contactId: contact.id }}
            path={path}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
