"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, GitMerge, UserCheck, XCircle, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateLeadAction, convertLeadAction, mergeLeadsAction } from "@/app/(app)/leads/actions";

type Dup = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; status: string };

export function LeadDetailActions({
  lead,
  accounts,
  products,
  owners,
  duplicates,
  readOnly,
  canReassign,
}: {
  lead: {
    id: string;
    status: string;
    firstName: string;
    lastName: string;
    company: string | null;
    convertedAccountId: string | null;
    convertedContactId: string | null;
    convertedDealId: string | null;
  };
  accounts: { id: string; legalName: string }[];
  products: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  duplicates: Dup[];
  readOnly: boolean;
  canReassign: boolean;
}) {
  const router = useRouter();
  const [convertOpen, setConvertOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // convert form
  const [accountMode, setAccountMode] = useState<"new" | "existing" | "none">(lead.company ? "new" : "none");
  const [accountName, setAccountName] = useState(lead.company ?? "");
  const [existingAccountId, setExistingAccountId] = useState("");
  const [createDeal, setCreateDeal] = useState(true);
  const [dealName, setDealName] = useState(`${lead.company ?? `${lead.firstName} ${lead.lastName}`} — New deal`);
  const [dealValue, setDealValue] = useState("0");
  const [dealProductId, setDealProductId] = useState("");

  if (readOnly) return null;
  const converted = lead.status === "CONVERTED";

  async function setStatus(status: string) {
    let reason: string | undefined;
    if (status === "DISQUALIFIED") {
      reason = window.prompt("Disqualification reason:") ?? undefined;
      if (!reason) return;
    }
    const res = await updateLeadAction(lead.id, { status, disqualifyReason: reason });
    if (res.ok) {
      toast.success("Status updated");
      router.refresh();
    } else toast.error(res.error);
  }

  async function reassign(ownerId: string) {
    const res = await updateLeadAction(lead.id, { ownerId });
    if (res.ok) {
      toast.success("Lead reassigned");
      router.refresh();
    } else toast.error(res.error);
  }

  async function submitConvert(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await convertLeadAction({
        leadId: lead.id,
        accountMode,
        existingAccountId: existingAccountId || undefined,
        accountName: accountName || undefined,
        contactMode: "new",
        createDeal,
        dealName: dealName || undefined,
        dealValue: Number(dealValue) || 0,
        dealProductId: dealProductId || undefined,
      });
      if (res.ok) {
        toast.success("Lead converted");
        setConvertOpen(false);
        if (res.dealId) router.push(`/deals/${res.dealId}`);
        else router.refresh();
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {!converted && (
        <Button onClick={() => setConvertOpen(true)}>
          <ArrowRightCircle /> Convert
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Actions <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!converted && (
            <>
              <DropdownMenuItem onSelect={() => setStatus("CONTACTED")}>
                <UserCheck /> Mark contacted
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setStatus("QUALIFIED")}>
                <UserCheck /> Mark qualified
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setStatus("DISQUALIFIED")}>
                <XCircle /> Disqualify…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {duplicates.length > 0 && (
            <DropdownMenuItem onSelect={() => setMergeOpen(true)}>
              <GitMerge /> Merge duplicates ({duplicates.length})
            </DropdownMenuItem>
          )}
          {canReassign && (
            <>
              <DropdownMenuSeparator />
              {owners.slice(0, 12).map((o) => (
                <DropdownMenuItem key={o.id} onSelect={() => reassign(o.id)}>
                  Assign to {o.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Conversion wizard */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convert lead</DialogTitle>
            <DialogDescription>
              Creates a client record (and optionally a deal) carrying the lead&apos;s history over.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitConvert} className="space-y-4">
            <div className="space-y-1">
              <Label>Company account</Label>
              <Select value={accountMode} onValueChange={(v) => setAccountMode(v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create new account (B2B)</SelectItem>
                  <SelectItem value="existing">Link existing account</SelectItem>
                  <SelectItem value="none">No account — individual client (B2C)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {accountMode === "new" && (
              <div className="space-y-1">
                <Label htmlFor="cv-account">Account legal name *</Label>
                <Input id="cv-account" required value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </div>
            )}
            {accountMode === "existing" && (
              <div className="space-y-1">
                <Label>Account *</Label>
                <Select value={existingAccountId} onValueChange={setExistingAccountId}>
                  <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.legalName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={createDeal} onCheckedChange={(c) => setCreateDeal(c === true)} />
              Create a deal in the pipeline
            </label>
            {createDeal && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="cv-deal">Deal name</Label>
                  <Input id="cv-deal" value={dealName} onChange={(e) => setDealName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cv-value">Value (QAR)</Label>
                  <Input id="cv-value" type="number" min={0} value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Product</Label>
                  <Select value={dealProductId || "none"} onValueChange={(v) => setDealProductId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving || (accountMode === "existing" && !existingAccountId)}>
                {saving ? "Converting…" : "Convert lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge duplicates</DialogTitle>
            <DialogDescription>
              Merging moves all activity, tasks and documents into this lead and archives the duplicate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {duplicates.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  {d.firstName} {d.lastName} · {d.email ?? d.phone} · {d.status}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    const res = await mergeLeadsAction(lead.id, d.id);
                    setSaving(false);
                    if (res.ok) {
                      toast.success("Merged");
                      setMergeOpen(false);
                      router.refresh();
                    } else toast.error(res.error);
                  }}
                >
                  <GitMerge /> Merge into this lead
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
