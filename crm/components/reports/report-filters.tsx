"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TERRITORIES = ["Doha North", "Doha South", "Al Rayyan", "Al Wakrah"];

export function ReportFilters({
  teams,
  reps,
  showTeamRep = true,
}: {
  teams: { id: string; name: string }[];
  reps: { id: string; name: string }[];
  showTeamRep?: boolean;
}) {
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
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-background p-2">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input type="date" className="h-8 w-36" value={params.get("dateFrom") ?? ""} onChange={(e) => setParam("dateFrom", e.target.value || null)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="date" className="h-8 w-36" value={params.get("dateTo") ?? ""} onChange={(e) => setParam("dateTo", e.target.value || null)} />
      </div>
      {showTeamRep && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Team</Label>
            <Select value={params.get("teamId") ?? "all"} onValueChange={(v) => setParam("teamId", v)}>
              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Team" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rep</Label>
            <Select value={params.get("ownerId") ?? "all"} onValueChange={(v) => setParam("ownerId", v)}>
              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Rep" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reps</SelectItem>
                {reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Territory</Label>
            <Select value={params.get("territory") ?? "all"} onValueChange={(v) => setParam("territory", v)}>
              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Territory" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All territories</SelectItem>
                {TERRITORIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
