import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDeal } from "@/lib/services/deals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/entity/timeline";
import { TasksCard } from "@/components/entity/tasks-card";
import { DocumentsCard } from "@/components/entity/documents-card";
import { QuickActions } from "@/components/entity/quick-actions";
import { DealStageBar } from "@/components/deals/deal-stage-bar";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function durationDays(from: Date, to: Date): string {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days < 1) return "<1 day";
  return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const deal = await getDeal(user, id);
  if (!deal) notFound();

  const readOnly = user.role === "READ_ONLY";
  const path = `/deals/${deal.id}`;
  const products = await db.product.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: "asc" } });

  const lineTotal = deal.products.reduce((s, p) => s + p.quantity * p.unitPrice, 0);

  // time-in-stage from history
  const historyWithDurations = deal.stageHistory.map((h, i) => {
    const next = deal.stageHistory[i + 1];
    return {
      id: h.id,
      from: h.fromStage?.name ?? null,
      to: h.toStage.name,
      at: h.createdAt,
      timeInStage: durationDays(h.createdAt, next?.createdAt ?? new Date()),
      current: !next,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/deals" aria-label="Back to deals">
            <ArrowLeft className="rtl-flip" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{deal.name}</h1>
        <Badge variant={deal.status === "WON" ? "success" : deal.status === "LOST" ? "secondary" : "info"}>
          {deal.status}
        </Badge>
        <span className="text-lg font-semibold">{fmtMoney(deal.value, deal.currency)}</span>
      </div>

      <DealStageBar
        dealId={deal.id}
        currentStageId={deal.stageId}
        status={deal.status}
        stages={deal.pipeline.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability, type: s.type }))}
        products={products.map((p) => ({ id: p.id, name: p.name, price: p.price, pricingModel: p.pricingModel }))}
        readOnly={readOnly}
      />

      {deal.status === "LOST" && deal.lossReason && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">Loss reason:</span> {deal.lossReason}
        </div>
      )}

      <QuickActions link={{ dealId: deal.id }} path={path} readOnly={readOnly} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Products</CardTitle>
            </CardHeader>
            <CardContent>
              {deal.products.length === 0 && <p className="text-sm text-muted-foreground">No line items</p>}
              {deal.products.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                  <span>
                    {p.product.name} <span className="text-muted-foreground">× {p.quantity}</span>
                  </span>
                  <span className="font-medium">{fmtMoney(p.quantity * p.unitPrice)}</span>
                </div>
              ))}
              {deal.products.length > 0 && (
                <p className="pt-2 text-end text-sm font-semibold">Total {fmtMoney(lineTotal)}</p>
              )}
            </CardContent>
          </Card>

          <ActivityTimeline
            activities={deal.activities.map((a) => ({
              id: a.id, type: a.type, subject: a.subject, body: a.body, occurredAt: a.occurredAt, userName: a.user.name,
            }))}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stage history</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {historyWithDurations.map((h) => (
                  <li key={h.id} className="flex items-baseline justify-between gap-2">
                    <span>
                      {h.from ? `${h.from} → ` : "Entered "}
                      <span className="font-medium">{h.to}</span>
                      <span className="ms-2 text-xs text-muted-foreground">{fmtDateTime(h.at)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {h.current ? `in stage ${h.timeInStage}` : h.timeInStage}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Pipeline</dt><dd>{deal.pipeline.name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Stage</dt><dd>{deal.stage.name} ({deal.probability ?? deal.stage.probability}%)</dd></div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Account</dt>
                  <dd>
                    {deal.account ? (
                      <Link href={`/clients/accounts/${deal.account.id}`} className="text-primary hover:underline">
                        {deal.account.legalName}
                      </Link>
                    ) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Primary contact</dt>
                  <dd>
                    {deal.primaryContact ? (
                      <Link href={`/clients/contacts/${deal.primaryContact.id}`} className="text-primary hover:underline">
                        {deal.primaryContact.firstName} {deal.primaryContact.lastName}
                      </Link>
                    ) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{deal.owner?.name ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Team</dt><dd>{deal.team?.name ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Expected close</dt><dd>{deal.expectedCloseAt ? fmtDate(deal.expectedCloseAt) : "—"}</dd></div>
                {deal.currency !== "QAR" && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">FX → QAR</dt><dd>{deal.fxRateToQar}</dd></div>
                )}
                {deal.wonAt && <div className="flex justify-between"><dt className="text-muted-foreground">Won</dt><dd>{fmtDate(deal.wonAt)}</dd></div>}
                {deal.lostAt && <div className="flex justify-between"><dt className="text-muted-foreground">Lost</dt><dd>{fmtDate(deal.lostAt)}</dd></div>}
              </dl>
            </CardContent>
          </Card>

          {deal.contacts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contacts involved</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {deal.contacts.map((dc) => (
                  <div key={dc.contactId} className="flex justify-between">
                    <Link href={`/clients/contacts/${dc.contact.id}`} className="text-primary hover:underline">
                      {dc.contact.firstName} {dc.contact.lastName}
                    </Link>
                    <span className="text-muted-foreground">{dc.role ?? dc.contact.position ?? ""}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {deal.subscriptions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Subscriptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {deal.subscriptions.map((s) => (
                  <div key={s.id} className="flex justify-between">
                    <span>{s.product.name}</span>
                    <span className="text-muted-foreground">
                      {s.status} · renews {s.renewalDate ? fmtDate(s.renewalDate) : "—"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <TasksCard
            tasks={deal.tasks.map((t) => ({
              id: t.id, title: t.title, dueAt: t.dueAt.toISOString(), priority: t.priority, status: t.status, ownerName: t.owner.name,
            }))}
            path={path}
            readOnly={readOnly}
          />
          <DocumentsCard
            documents={deal.documents.map((d) => ({
              id: d.id, name: d.name, category: d.category, mime: d.mime, size: d.size, version: d.version,
              uploadedByName: d.uploadedBy.name, updatedAt: d.updatedAt.toISOString(),
            }))}
            link={{ dealId: deal.id }}
            path={path}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
