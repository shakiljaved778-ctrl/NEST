"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DealFiltersBar({
  pipelines,
  owners,
  currentPipelineId,
}: {
  pipelines: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  currentPipelineId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      next.delete("page");
      router.push(`?${next.toString()}`);
    },
    [params, router]
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
      {pipelines.length > 1 && (
        <Select value={currentPipelineId} onValueChange={(v) => setParam("pipelineId", v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = (new FormData(e.currentTarget).get("q") as string) || null;
          setParam("q", q);
        }}
      >
        <Input name="q" placeholder="Search deals…" defaultValue={params.get("q") ?? ""} className="w-56" />
      </form>
      <Select value={params.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="OPEN">Open</SelectItem>
          <SelectItem value="WON">Won</SelectItem>
          <SelectItem value="LOST">Lost</SelectItem>
        </SelectContent>
      </Select>
      <Select value={params.get("ownerId") ?? "all"} onValueChange={(v) => setParam("ownerId", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All owners</SelectItem>
          {owners.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
