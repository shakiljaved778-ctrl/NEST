"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  changePasswordAction,
  beginTotpAction,
  confirmTotpAction,
  disableTotpAction,
  setEmailDigestAction,
} from "@/app/(app)/settings/actions";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await changePasswordAction(current, next);
      if (res.ok) {
        toast.success("Password updated");
        setCurrent("");
        setNext("");
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="cur-pw">Current password</Label>
        <Input id="cur-pw" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-pw">New password</Label>
        <Input id="new-pw" type="password" required value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Update password"}</Button>
    </form>
  );
}

export function TotpSection({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    try {
      const res = await beginTotpAction();
      if (res.ok) {
        setSecret(res.secret ?? null);
        setUri(res.uri ?? null);
      } else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const res = await confirmTotpAction(code);
      if (res.ok) {
        toast.success("Two-factor enabled");
        setSecret(null);
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const res = await disableTotpAction();
      if (res.ok) {
        toast.success("Two-factor disabled");
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  if (enabled) {
    return (
      <div className="flex items-center justify-between">
        <Badge variant="success">Enabled</Badge>
        <Button variant="outline" size="sm" disabled={busy} onClick={disable}>
          Disable 2FA
        </Button>
      </div>
    );
  }

  if (secret) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add this secret to your authenticator app (Google Authenticator, Authy, 1Password…), then enter the 6-digit code
          to confirm.
        </p>
        <div className="rounded-md border bg-muted/50 p-2 font-mono text-sm">{secret}</div>
        <p className="break-all text-xs text-muted-foreground">{uri}</p>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="totp-code">Verification code</Label>
            <Input id="totp-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="w-32" />
          </div>
          <Button disabled={busy || code.length !== 6} onClick={confirm}>Confirm</Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="outline" disabled={busy} onClick={begin}>
      Set up authenticator
    </Button>
  );
}

export function DigestToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  return (
    <label className="flex items-center justify-between text-sm">
      <span>Daily email digest (new leads, tasks due, overdue)</span>
      <Switch
        checked={on}
        onCheckedChange={async (v) => {
          setOn(v);
          const res = await setEmailDigestAction(v);
          if (res.ok) toast.success("Preference saved");
          else {
            setOn(!v);
            toast.error(res.error);
          }
        }}
      />
    </label>
  );
}
