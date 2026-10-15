"use client";

import { Button } from "@amil/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall, errorText } from "@/lib/client";
import { ROLE_LABELS } from "@/lib/labels";

const ROLES = ["admin", "product", "compliance", "sharia", "viewer"] as const;

function RoleSelect({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange: (role: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      className="field w-auto"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]?.title ?? r}
        </option>
      ))}
    </select>
  );
}

/** Add a staff member by their Okta email (D-081). */
export function AddStaff() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    setError(null);
    const r = await adminCall("POST", "/staff", { email: email.trim(), name: name.trim(), role });
    setBusy(false);
    if (!r.ok) {
      setError(r.issues[0]?.message ?? errorText(r.error));
      return;
    }
    setEmail("");
    setName("");
    setRole("viewer");
    router.refresh();
  };
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      data-testid="add-staff"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <input
        aria-label="Email"
        type="email"
        required
        placeholder="name@bank (their Okta email)"
        className="field max-w-xs"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        aria-label="Name"
        required
        placeholder="Full name"
        className="field max-w-xs"
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <RoleSelect label="Role" value={role} onChange={setRole} />
      <Button size="sm" type="submit" disabled={busy}>
        Add
      </Button>
      {error ? (
        <span className="text-sm text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}

/** Change a person's role, or deactivate or reactivate them, with a reason. */
export function StaffActions({
  id,
  name,
  role,
  active,
  self,
}: {
  id: string;
  name: string;
  role: string;
  active: boolean;
  self: boolean;
}) {
  const router = useRouter();
  const [nextRole, setNextRole] = useState(role);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (self) return <span className="text-xs text-ink-muted">Your own access: another admin</span>;
  const change = async (patch: { role?: string; active?: boolean }, question: string) => {
    const reason = window.prompt(question, "");
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError(errorText("reason_required"));
      return;
    }
    setBusy(true);
    setError(null);
    const r = await adminCall("PATCH", `/staff/${id}`, { ...patch, comment: reason.trim() });
    setBusy(false);
    if (!r.ok) setError(r.issues[0]?.message ?? errorText(r.error));
    else router.refresh();
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {active ? (
        <>
          <RoleSelect
            label={`Role for ${name}`}
            value={nextRole}
            disabled={busy}
            onChange={setNextRole}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || nextRole === role}
            onClick={() =>
              void change(
                { role: nextRole },
                `Change ${name} to ${ROLE_LABELS[nextRole]?.title ?? nextRole}? Reason:`,
              )
            }
          >
            Change role
          </Button>
        </>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          void change(
            { active: !active },
            active
              ? `Deactivate ${name}? They lose console access at once. Reason:`
              : `Reactivate ${name}? Reason:`,
          )
        }
      >
        {active ? "Deactivate" : "Reactivate"}
      </Button>
      {error ? (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
