"use client";

import { Button } from "@amil/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall, errorText } from "@/lib/client";

/** Compliance's decision on a proposed parameter version (four eyes, D-074). */
export function PackReview({ versionId, canApprove }: { versionId: string; canApprove: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!canApprove)
    return (
      <p className="text-xs text-ink-muted">
        Waiting for compliance. It is not applied until it is approved.
      </p>
    );
  const review = async (action: "approve" | "reject") => {
    setBusy(true);
    setError(null);
    const r = await adminCall("POST", `/rule-packs/versions/${versionId}/review`, {
      action,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    setBusy(false);
    if (!r.ok) setError(errorText(r.error));
    else router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="pack-review">
      <input
        aria-label="Review comment"
        placeholder="Comment (required to reject)"
        className="field max-w-xs"
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button size="sm" disabled={busy} onClick={() => void review("approve")}>
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void review("reject")}>
        Reject
      </Button>
      {error ? (
        <span className="text-sm text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
