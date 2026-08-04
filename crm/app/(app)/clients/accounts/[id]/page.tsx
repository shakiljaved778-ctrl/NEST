import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Globe, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAccount, getKycChecklist } from "@/lib/services/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/entity/timeline";
import { TasksCard } from "@/components/entity/tasks-card";
import { DocumentsCard } from "@/components/entity/documents-card";
import { QuickActions } from "@/components/entity/quick-actions";
import { KycChecklist } from "@/components/clients/kyc-checklist";
import { SubscriptionsCard } from "@/components/clients/subscriptions-card";
import { EraseClientButton } from "@/components/clients/erase-client-button";
import { fmtMoney } from "@/lib/utils";
import { isManagerial } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = { ACTIVE: "success", PROSPECT: "info", CHURNED: "secondary" } as const;

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const account = await getAccount(user, id);
  if (!account) notFound();

  const kyc = await getKycChecklist("account", account.id);
  const readOnly = user.role === "READ_ONLY";
  const path = `/clients/accounts/${account.id}`;

  const openDeals = account.deals.filter((d) => d.stage.type === "OPEN");
  const wonDeals = account.deals.filter((d) => d.stage.type === "WON");
  const wonValue = wonDeals.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients" aria-label="Back to clients">
            <ArrowLeft className="rtl-flip" />
          </Link>
        </Button>
        <Building2 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">{account.legalName}</h1>
        <Badge variant={STATUS_VARIANT[account.status]}>{account.status}</Badge>
        <Badge variant="outline">B2B</Badge>
        {isManagerial(user.role) && (
          <div className="ms-auto flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/clients/account/${account.id}/export`} download>
                Export data (PDPPL)
              </a>
            </Button>
            {user.role === "ADMIN" && <EraseClientButton clientType="account" clientId={account.id} name={account.legalName} />}
          </div>
        )}
      </div>

      <QuickActions link={{ accountId: account.id }} path={path} readOnly={readOnly} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Company profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Trade name</dt><dd>{account.tradeName ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">CR number</dt><dd>{account.crNumber ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Industry</dt><dd>{account.industry ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Size</dt><dd>{account.size ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{account.owner?.name ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Territory</dt><dd>{account.territory ?? "—"}</dd></div>
                {account.website && (
                  <div className="col-span-2 flex items-center gap-1 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    <a href={account.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {account.website}
                    </a>
                  </div>
                )}
                {account.address && (
                  <div className="col-span-2 flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {account.address}, {account.city}
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contacts ({account.contacts.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {account.contacts.length === 0 && <p className="text-muted-foreground">No contacts</p>}
              {account.contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <Link href={`/clients/contacts/${c.id}`} className="text-primary hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {c.position ?? ""} {c.email ? `· ${c.email}` : ""}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Deals</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {openDeals.length} open · {wonDeals.length} won ({fmtMoney(wonValue)})
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {account.deals.length === 0 && <p className="text-muted-foreground">No deals</p>}
              {account.deals.map((d) => (
                <div key={d.id} className="flex items-center justify-between">
                  <Link href={`/deals/${d.id}`} className="text-primary hover:underline">{d.name}</Link>
                  <span className="text-xs text-muted-foreground">
                    {d.stage.name} · {fmtMoney(d.value, d.currency)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <ActivityTimeline
            activities={account.activities.map((a) => ({
              id: a.id, type: a.type, subject: a.subject, body: a.body, occurredAt: a.occurredAt, userName: a.user.name,
            }))}
          />
        </div>

        <div className="space-y-4">
          <SubscriptionsCard
            subscriptions={account.subscriptions.map((s) => ({
              id: s.id, productName: s.product.name, status: s.status,
              startDate: s.startDate.toISOString(), renewalDate: s.renewalDate?.toISOString() ?? null, mrrValue: s.mrrValue,
            }))}
          />
          <KycChecklist items={kyc} accountId={account.id} readOnly={readOnly} />
          <TasksCard
            tasks={account.tasks.map((t) => ({
              id: t.id, title: t.title, dueAt: t.dueAt.toISOString(), priority: t.priority, status: t.status, ownerName: t.owner.name,
            }))}
            path={path}
            readOnly={readOnly}
          />
          <DocumentsCard
            documents={account.documents.map((d) => ({
              id: d.id, name: d.name, category: d.category, mime: d.mime, size: d.size, version: d.version,
              uploadedByName: d.uploadedBy.name, updatedAt: d.updatedAt.toISOString(),
            }))}
            link={{ accountId: account.id }}
            path={path}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
