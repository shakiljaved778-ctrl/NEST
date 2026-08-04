"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Building2, Contact as ContactIcon, Handshake, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchResult = {
  type: "lead" | "account" | "contact" | "deal";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const ICONS = { lead: Users, account: Building2, contact: ContactIcon, deal: Handshake };

export function CommandK({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setSelected(0);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const go = useCallback(
    (r: SearchResult) => {
      onOpenChange(false);
      setQuery("");
      router.push(r.href);
    },
    [onOpenChange, router]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 gap-2 p-3">
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <Input
          autoFocus
          placeholder="Search leads, clients, deals…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && results[selected]) {
              go(results[selected]);
            }
          }}
        />
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!loading && query && results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No results</p>
          )}
          {results.map((r, i) => {
            const Icon = ICONS[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm",
                  i === selected ? "bg-accent" : "hover:bg-accent/50"
                )}
                onMouseEnter={() => setSelected(i)}
                onClick={() => go(r)}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title}</span>
                  {r.subtitle && <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                </span>
                <span className="text-xs uppercase text-muted-foreground">{r.type}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
