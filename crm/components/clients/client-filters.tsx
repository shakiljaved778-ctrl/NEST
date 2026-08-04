"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ClientFiltersBar({ owners }: { owners: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      router.push(`?${next.toString()}`);
    },
    [params, router]
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", (new FormData(e.currentTarget).get("q") as string) || null);
        }}
      >
        <Input name="q" placeholder="Search clients…" defaultValue={params.get("q") ?? ""} className="w-56" />
      </form>
      <Select value={params.get("type") ?? "all"} onValueChange={(v) => setParam("type", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="account">B2B (companies)</SelectItem>
          <SelectItem value="contact">B2C (individuals)</SelectItem>
        </SelectContent>
      </Select>
      <Select value={params.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="PROSPECT">Prospect</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="CHURNED">Churned</SelectItem>
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
