"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "@/app/(app)/actions";

export function MarkAllReadButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const res = await markNotificationsRead();
        if (res.ok) {
          toast.success("Marked all as read");
          router.refresh();
        } else toast.error(res.error);
      }}
    >
      <CheckCheck /> Mark all read
    </Button>
  );
}
