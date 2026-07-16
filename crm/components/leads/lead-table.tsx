"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpDown, Clock, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate, relativeTime } from "@/lib/utils";
import { bulkLeadActionServer } from "@/app/(app)/leads/actions";
import type { LeadStatus } from "@prisma/client";

export type LeadRow = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  score: number;
  territory: string | null;
  owner: string | null;
  product: string | null;
  createdAt: string;
  slaDueAt: string | null;
  firstTouchAt: string | null;
  slaBreachedAt: string | null;
};

const STATUS_VARIANT: Record<string, "info" | "warning" | "success" | "secondary" | "destructive"> = {
  NEW: "info",
  CONTACTED: "warning",
  QUALIFIED: "purple" as never,
  CONVERTED: "success",
  DISQUALIFIED: "secondary",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

export function SlaCell({ lead }: { lead: Pick<LeadRow, "status" | "slaDueAt" | "firstTouchAt" | "slaBreachedAt"> }) {
  if (lead.firstTouchAt) return <span className="text-xs text-muted-foreground">touched</span>;
  if (lead.status !== "NEW") return <span className="text-xs text-muted-foreground">—</span>;
  if (!lead.slaDueAt) return <span className="text-xs text-muted-foreground">—</span>;
  const due = new Date(lead.slaDueAt);
  const breached = lead.slaBreachedAt || due < new Date();
  return breached ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertTriangle className="h-3 w-3" /> breached
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
      <Clock className="h-3 w-3" /> {relativeTime(due)}
    </span>
  );
}

export function LeadTable({
  leads,
  owners,
  canBulkAssign,
  readOnly,
}: {
  leads: LeadRow[];
  owners: { id: string; name: string }[];
  canBulkAssign: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggleSort(field: string) {
    const next = new URLSearchParams(params.toString());
    const currentSort = next.get("sort");
    const currentDir = next.get("dir") ?? "desc";
    next.set("sort", field);
    next.set("dir", currentSort === field && currentDir === "desc" ? "asc" : "desc");
    router.push(`?${next.toString()}`);
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(leads.map((l) => l.id)) : new Set());
  }

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function runBulk(
    action:
      | { type: "assign"; ownerId: string }
      | { type: "status"; status: LeadStatus; reason?: string }
      | { type: "delete" }
  ) {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkLeadActionServer(ids, action);
      if (res.ok) {
        toast.success(`Updated ${res.id} lead(s)`);
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const SortHead = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(field)}>
        {children} <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );

  return (
    <div className="rounded-lg border bg-background">
      {selected.size > 0 && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 p-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          {canBulkAssign && (
            <Select onValueChange={(v) => runBulk({ type: "assign", ownerId: v })} disabled={pending}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="Assign to…" />
              </SelectTrigger>
              <SelectContent>
                {owners.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            onValueChange={(v) => {
              if (v === "DISQUALIFIED") {
                const reason = window.prompt("Disqualification reason:");
                if (!reason) return;
                runBulk({ type: "status", status: v as LeadStatus, reason });
              } else {
                runBulk({ type: "status", status: v as LeadStatus });
              }
            }}
            disabled={pending}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Change status…" />
            </SelectTrigger>
            <SelectContent>
              {["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Delete ${selected.size} lead(s)? They can be restored by an admin.`)) {
                runBulk({ type: "delete" });
              }
            }}
          >
            Delete
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {!readOnly && (
              <TableHead className="w-8">
                <Checkbox
                  checked={selected.size === leads.length && leads.length > 0}
                  onCheckedChange={(c) => toggleAll(c === true)}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <SortHead field="name">Name</SortHead>
            <TableHead>Company</TableHead>
            <SortHead field="status">Status</SortHead>
            <TableHead>Source</TableHead>
            <SortHead field="score">Score</SortHead>
            <TableHead>Owner</TableHead>
            <TableHead>Territory</TableHead>
            <SortHead field="slaDueAt">SLA</SortHead>
            <SortHead field="createdAt">Created</SortHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                No leads match these filters
              </TableCell>
            </TableRow>
          )}
          {leads.map((lead) => (
            <TableRow key={lead.id} data-state={selected.has(lead.id) ? "selected" : undefined}>
              {!readOnly && (
                <TableCell>
                  <Checkbox
                    checked={selected.has(lead.id)}
                    onCheckedChange={(c) => toggle(lead.id, c === true)}
                    aria-label={`Select ${lead.name}`}
                  />
                </TableCell>
              )}
              <TableCell>
                <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                  {lead.name}
                </Link>
                <div className="text-xs text-muted-foreground">{lead.email ?? lead.phone ?? ""}</div>
              </TableCell>
              <TableCell className="max-w-40 truncate">{lead.company ?? "—"}</TableCell>
              <TableCell>
                <LeadStatusBadge status={lead.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{lead.source}</TableCell>
              <TableCell>
                <span
                  className={
                    lead.score >= 70 ? "font-semibold text-emerald-600" : lead.score >= 40 ? "text-amber-600" : "text-muted-foreground"
                  }
                >
                  {lead.score}
                </span>
              </TableCell>
              <TableCell>{lead.owner ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
              <TableCell className="text-muted-foreground">{lead.territory ?? "—"}</TableCell>
              <TableCell>
                <SlaCell lead={lead} />
              </TableCell>
              <TableCell className="text-muted-foreground">{fmtDate(lead.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
