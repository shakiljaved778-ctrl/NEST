"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { setKycStatusAction } from "@/app/(app)/clients/actions";

export type KycItem = { itemId: string; name: string; required: boolean; complete: boolean; documentName: string | null };

export function KycChecklist({
  items,
  accountId,
  contactId,
  readOnly,
}: {
  items: KycItem[];
  accountId?: string;
  contactId?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const requiredDone = items.filter((i) => i.required && i.complete).length;
  const requiredTotal = items.filter((i) => i.required).length;
  const allComplete = requiredTotal > 0 && requiredDone === requiredTotal;

  async function toggle(item: KycItem, complete: boolean) {
    const res = await setKycStatusAction({ checklistItemId: item.itemId, accountId, contactId, complete });
    if (res.ok) {
      toast.success(complete ? "Marked complete" : "Marked incomplete");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {allComplete ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-500" />}
            KYC checklist
          </CardTitle>
          <Badge variant={allComplete ? "success" : "warning"}>
            {requiredDone}/{requiredTotal} required
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No checklist items configured</p>}
        {items.map((item) => (
          <div key={item.itemId} className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={item.complete}
              disabled={readOnly}
              onCheckedChange={(c) => toggle(item, c === true)}
              aria-label={item.name}
            />
            <div className="flex-1">
              <span className={item.complete ? "text-muted-foreground line-through" : ""}>
                {item.name}
                {item.required && <span className="text-destructive"> *</span>}
              </span>
              {item.documentName && <div className="text-xs text-muted-foreground">📎 {item.documentName}</div>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
