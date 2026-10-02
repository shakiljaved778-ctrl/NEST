import { Badge } from "@amil/ui";
import { STATUS_LABELS } from "@/lib/labels";

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "sharia_approved"
      ? "brand"
      : status === "in_review" || status === "compliance_approved"
        ? "warning"
        : "neutral";
  return <Badge tone={tone}>{STATUS_LABELS[status] ?? status}</Badge>;
}
