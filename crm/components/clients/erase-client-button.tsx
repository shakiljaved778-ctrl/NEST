"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { eraseClientAction } from "@/app/(app)/admin/actions";

// PDPPL right-to-erasure. Admin only; irreversible; the request is audit-logged.
export function EraseClientButton({ clientType, clientId, name }: { clientType: "account" | "contact"; clientId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function erase() {
    setBusy(true);
    try {
      const res = await eraseClientAction(clientType, clientId);
      if (res.ok) {
        toast.success("Client data erased");
        setOpen(false);
        router.push("/clients");
      } else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <ShieldX /> Erase (PDPPL)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hard-erase client data</DialogTitle>
          <DialogDescription>
            This permanently deletes <span className="font-medium">{name}</span> and its personal data under the right to
            erasure (Qatar Law No. 13 of 2016). The erasure request itself is recorded in the audit trail. This cannot be
            undone. Type <span className="font-mono font-medium">ERASE</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ERASE" />
        <DialogFooter>
          <Button variant="destructive" disabled={confirm !== "ERASE" || busy} onClick={erase}>
            {busy ? "Erasing…" : "Erase permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
