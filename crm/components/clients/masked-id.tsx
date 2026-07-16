"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { maskId } from "@/lib/crypto";
import { revealNationalIdAction } from "@/app/(app)/clients/actions";

// Masked identifier display: shows last-3 only; reveal fetches the decrypted
// value via a server action that audit-logs the reveal.
export function MaskedId({
  contactId,
  last3,
  docType,
  canReveal,
}: {
  contactId: string;
  last3: string | null;
  docType: string | null;
  canReveal: boolean;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!last3) return <span className="text-muted-foreground">—</span>;

  async function reveal() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setLoading(true);
    try {
      const res = await revealNationalIdAction(contactId);
      if (res.ok && res.value != null) setRevealed(res.value);
      else toast.error(res.ok ? "No value" : res.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 font-mono">
      {docType && <span className="text-xs text-muted-foreground">{docType}</span>}
      <span>{revealed ?? maskId(last3)}</span>
      {canReveal && (
        <button onClick={reveal} disabled={loading} aria-label={revealed ? "Hide" : "Reveal (logged)"} className="text-muted-foreground hover:text-foreground">
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}
