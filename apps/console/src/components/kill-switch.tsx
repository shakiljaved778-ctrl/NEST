"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall, errorText } from "@/lib/client";

/**
 * Kill switch (non-negotiable 9): disabling stops the pack or template at once; customers get no
 * insight (never an error) and the bank's flow continues.
 */
export function KillSwitch({
  path,
  enabled,
  canWrite,
  name,
}: {
  path: string;
  enabled: boolean;
  canWrite: boolean;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    const next = !enabled;
    if (!next && !window.confirm(`Turn off ${name}? Customers will see no insight for it.`)) return;
    setBusy(true);
    setError(null);
    const r = await adminCall("PATCH", path, { enabled: next });
    setBusy(false);
    if (!r.ok) setError(errorText(r.error));
    else router.refresh();
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${name}: ${enabled ? "on" : "off"}`}
        disabled={!canWrite || busy}
        onClick={() => void toggle()}
        className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-emerald-600" : "bg-zinc-300"} disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
      <span className="text-xs text-ink-muted">{enabled ? "On" : "Off"}</span>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
