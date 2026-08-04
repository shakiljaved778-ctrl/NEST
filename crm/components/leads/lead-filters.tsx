"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkPlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveViewAction, deleteViewAction } from "@/app/(app)/leads/actions";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "DISQUALIFIED"];
const SOURCES = ["web-form", "webhook", "csv-import", "referral", "event", "cold-call", "manual"];
const TERRITORIES = ["Doha North", "Doha South", "Al Rayyan", "Al Wakrah"];
const FILTER_KEYS = ["q", "status", "source", "ownerId", "territory", "minScore", "dateFrom", "dateTo", "sort", "dir"];

export function LeadFiltersBar({
  owners,
  savedViews,
}: {
  owners: { id: string; name: string }[];
  savedViews: { id: string; name: string; filters: Record<string, string>; own: boolean }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      next.delete("page");
      startTransition(() => router.push(`?${next.toString()}`));
    },
    [params, router]
  );

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  async function saveCurrentView() {
    const name = window.prompt("Name this view:");
    if (!name) return;
    const filters: Record<string, string> = {};
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v) filters[k] = v;
    }
    const res = await saveViewAction({ entity: "lead", name, filters, shared: false });
    if (res.ok) toast.success("View saved");
    else toast.error(res.error);
  }

  function applyView(filters: Record<string, string>) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) next.set(k, v);
    router.push(`?${next.toString()}`);
    setQ(filters.q ?? "");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q || null);
        }}
      >
        <Input
          placeholder="Search name, company, email, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
      </form>
      <Select value={params.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("source") ?? "all"} onValueChange={(v) => setParam("source", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          {SOURCES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("ownerId") ?? "all"} onValueChange={(v) => setParam("ownerId", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All owners</SelectItem>
          {owners.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("territory") ?? "all"} onValueChange={(v) => setParam("territory", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Territory" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All territories</SelectItem>
          {TERRITORIES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        className="w-36"
        value={params.get("dateFrom") ?? ""}
        onChange={(e) => setParam("dateFrom", e.target.value || null)}
        aria-label="From date"
      />
      <Input
        type="date"
        className="w-36"
        value={params.get("dateTo") ?? ""}
        onChange={(e) => setParam("dateTo", e.target.value || null)}
        aria-label="To date"
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => { router.push("?"); setQ(""); }}>
          <X /> Clear
        </Button>
      )}
      <div className="ms-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Bookmark /> Views
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Saved views</DropdownMenuLabel>
            {savedViews.length === 0 && (
              <DropdownMenuItem disabled>No saved views</DropdownMenuItem>
            )}
            {savedViews.map((v) => (
              <DropdownMenuItem key={v.id} className="flex justify-between" onSelect={() => applyView(v.filters)}>
                <span>{v.name}</span>
                {v.own && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await deleteViewAction(v.id);
                      toast.success("View deleted");
                    }}
                    aria-label={`Delete view ${v.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={saveCurrentView}>
              <BookmarkPlus /> Save current filters…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
