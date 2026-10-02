"use client";

import { Button } from "@amil/ui";
import { useState } from "react";
import { adminCall, errorText } from "@/lib/client";
import type { ChainCheck } from "@/lib/types";

/** Re-verifies the bank's whole hash chain on demand. */
export function VerifyChainButton() {
  const [result, setResult] = useState<ChainCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          void adminCall<ChainCheck>("GET", "/audit/verify").then((r) => {
            setBusy(false);
            if (r.ok) setResult(r.data);
            else setError(errorText(r.error));
          });
        }}
      >
        {busy ? "Verifying…" : "Verify hash chain"}
      </Button>
      {result ? (
        <span
          role="status"
          className={`text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`}
          data-testid="chain-result"
        >
          {result.ok
            ? `Chain intact: ${result.checked.toLocaleString("en")} events verified.`
            : `Chain broken at event ${result.firstBrokenSeq} (${result.reason}).`}
        </span>
      ) : null}
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </span>
  );
}
