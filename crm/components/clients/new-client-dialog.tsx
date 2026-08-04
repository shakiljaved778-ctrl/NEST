"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createAccountAction, createContactAction } from "@/app/(app)/clients/actions";

const TERRITORIES = ["Doha North", "Doha South", "Al Rayyan", "Al Wakrah"];

export function NewClientDialog({
  accounts,
  owners,
  readOnly,
}: {
  accounts: { id: string; legalName: string }[];
  owners: { id: string; name: string }[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [acc, setAcc] = useState({ legalName: "", crNumber: "", industry: "", size: "", website: "", city: "Doha", territory: "", status: "PROSPECT" });
  const [con, setCon] = useState({ firstName: "", lastName: "", accountId: "", position: "", email: "", phone: "", idDocType: "QID", nationalId: "", nationality: "", preferredLanguage: "EN", consent: false });

  if (readOnly) return null;

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await createAccountAction({
        ...acc,
        crNumber: acc.crNumber || null,
        industry: acc.industry || null,
        size: acc.size || null,
        website: acc.website || null,
        territory: acc.territory || null,
      });
      if (res.ok) {
        toast.success("Account created");
        setOpen(false);
        router.push(`/clients/accounts/${res.id}`);
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await createContactAction({
        ...con,
        accountId: con.accountId || null,
        clientStatus: con.accountId ? null : "PROSPECT",
        position: con.position || null,
        email: con.email || null,
        phone: con.phone || null,
        nationalId: con.nationalId || null,
        nationality: con.nationality || null,
        lawfulBasis: con.consent ? "CONSENT" : null,
      });
      if (res.ok) {
        toast.success("Contact created");
        setOpen(false);
        router.push(`/clients/contacts/${res.id}`);
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="account">
          <TabsList className="w-full">
            <TabsTrigger value="account" className="flex-1">Company (B2B)</TabsTrigger>
            <TabsTrigger value="contact" className="flex-1">Individual (B2C)</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <form onSubmit={submitAccount} className="grid grid-cols-2 gap-3 pt-2">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="ac-name">Legal name *</Label>
                <Input id="ac-name" required value={acc.legalName} onChange={(e) => setAcc({ ...acc, legalName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ac-cr">CR / trade license</Label>
                <Input id="ac-cr" value={acc.crNumber} onChange={(e) => setAcc({ ...acc, crNumber: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ac-ind">Industry</Label>
                <Input id="ac-ind" value={acc.industry} onChange={(e) => setAcc({ ...acc, industry: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Size</Label>
                <Select value={acc.size || "none"} onValueChange={(v) => setAcc({ ...acc, size: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {["1-10", "11-50", "51-200", "200+"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Territory</Label>
                <Select value={acc.territory || "none"} onValueChange={(v) => setAcc({ ...acc, territory: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Territory" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {TERRITORIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="ac-web">Website</Label>
                <Input id="ac-web" type="url" placeholder="https://…" value={acc.website} onChange={(e) => setAcc({ ...acc, website: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={acc.status} onValueChange={(v) => setAcc({ ...acc, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["PROSPECT", "ACTIVE", "CHURNED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="col-span-2">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create account"}</Button>
              </DialogFooter>
            </form>
          </TabsContent>
          <TabsContent value="contact">
            <form onSubmit={submitContact} className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label htmlFor="cn-first">First name *</Label>
                <Input id="cn-first" required value={con.firstName} onChange={(e) => setCon({ ...con, firstName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cn-last">Last name *</Label>
                <Input id="cn-last" required value={con.lastName} onChange={(e) => setCon({ ...con, lastName: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Company account (leave empty for individual B2C client)</Label>
                <Select value={con.accountId || "none"} onValueChange={(v) => setCon({ ...con, accountId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Individual (no company)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Individual (no company)</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.legalName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cn-email">Email</Label>
                <Input id="cn-email" type="email" value={con.email} onChange={(e) => setCon({ ...con, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cn-phone">Phone</Label>
                <Input id="cn-phone" value={con.phone} onChange={(e) => setCon({ ...con, phone: e.target.value })} placeholder="+974 …" />
              </div>
              <div className="space-y-1">
                <Label>ID type</Label>
                <Select value={con.idDocType} onValueChange={(v) => setCon({ ...con, idDocType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QID">QID</SelectItem>
                    <SelectItem value="PASSPORT">Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cn-id">{con.idDocType} number (encrypted)</Label>
                <Input id="cn-id" value={con.nationalId} onChange={(e) => setCon({ ...con, nationalId: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cn-nat">Nationality</Label>
                <Input id="cn-nat" value={con.nationality} onChange={(e) => setCon({ ...con, nationality: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Preferred language</Label>
                <Select value={con.preferredLanguage} onValueChange={(v) => setCon({ ...con, preferredLanguage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EN">English</SelectItem>
                    <SelectItem value="AR">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <Checkbox checked={con.consent} onCheckedChange={(c) => setCon({ ...con, consent: c === true })} />
                Consent to processing recorded (PDPPL lawful basis)
              </label>
              <DialogFooter className="col-span-2">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create contact"}</Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
