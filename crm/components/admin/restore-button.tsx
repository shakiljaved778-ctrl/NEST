"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restoreEntityAction } from "@/app/(app)/admin/actions";

export function RestoreButton({ entity, id }: { entity: string; id: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const res = await restoreEntityAction(entity, id);
        if (res.ok) { toast.success("Restored"); router.refresh(); }
        else toast.error(res.error);
      }}
    >
      <RotateCcw /> Restore
    </Button>
  );
}
