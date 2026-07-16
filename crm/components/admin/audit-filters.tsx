"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "RESTORE", "VIEW", "DOWNLOAD", "REVEAL", "LOGIN", "LOGIN_FAILED", "LOCKOUT", "EXPORT", "ERASE", "ASSIGN", "CONVERT", "MERGE", "STAGE_CHANGE", "SLA_BREACH"];
const ENTITIES = ["USER", "TEAM", "LEAD", "ACCOUNT", "CONTACT", "DEAL", "PRODUCT", "SUBSCRIPTION", "DOCUMENT", "ROUTING_RULE", "KYC_ITEM", "CUSTOM_FIELD", "SETTING"];

export function AuditFilters() {
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
      <Input
        placeholder="Actor email…"
        defaultValue={params.get("actor") ?? ""}
        className="w-48"
        onKeyDown={(e) => { if (e.key === "Enter") setParam("actor", (e.target as HTMLInputElement).value || null); }}
      />
      <Select value={params.get("action") ?? "all"} onValueChange={(v) => setParam("action", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Action" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All actions</SelectItem>
          {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={params.get("entityType") ?? "all"} onValueChange={(v) => setParam("entityType", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Entity" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All entities</SelectItem>
          {ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="date" className="w-36" defaultValue={params.get("dateFrom") ?? ""} onChange={(e) => setParam("dateFrom", e.target.value || null)} aria-label="From" />
      <Input type="date" className="w-36" defaultValue={params.get("dateTo") ?? ""} onChange={(e) => setParam("dateTo", e.target.value || null)} aria-label="To" />
    </div>
  );
}
