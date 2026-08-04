"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({ page, pages, total }: { page: number; pages: number; total: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="flex items-center justify-between px-1 py-2 text-sm text-muted-foreground">
      <span>
        Page {page} of {pages} · {total.toLocaleString()} records
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => go(page - 1)}>
          <ChevronLeft className="rtl-flip" />
        </Button>
        <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => go(page + 1)}>
          <ChevronRight className="rtl-flip" />
        </Button>
      </div>
    </div>
  );
}
