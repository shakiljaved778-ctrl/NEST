"use client";
/**
 * Global symbol search + keyboard shortcuts.
 *
 *   /            focus / open search
 *   g then d     go to dashboard
 *   g then m     go to macro
 *   g then p     go to portfolio
 *   Esc          close search
 *
 * Exposes an imperative open() via context so the top bar's search box can
 * trigger the same modal.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Instrument } from "@/types/market";
import { marketApi } from "@/lib/market/api";

interface SearchCtx {
  open: () => void;
}
const Ctx = createContext<SearchCtx>({ open: () => {} });
export const useSearch = () => useContext(Ctx);

export function SearchCommandProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingG = useRef(false);

  const openModal = useCallback(() => {
    setOpen(true);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  // Global keydown: "/" opens search, "g x" chords navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "/" && !typing) {
        e.preventDefault();
        openModal();
        return;
      }
      if (typing) return;

      if (e.key.toLowerCase() === "g") {
        pendingG.current = true;
        setTimeout(() => (pendingG.current = false), 800);
        return;
      }
      if (pendingG.current) {
        pendingG.current = false;
        if (e.key === "d") router.push("/markets");
        else if (e.key === "m") router.push("/markets/macro");
        else if (e.key === "p") router.push("/markets/portfolio");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openModal, router]);

  // Focus input when opened.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const { results } = await marketApi.search(q);
        setResults(results);
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 120);
    return () => clearTimeout(id);
  }, [query, open]);

  const go = useCallback(
    (symbol: string) => {
      setOpen(false);
      router.push(`/markets/symbol/${symbol}`);
    },
    [router],
  );

  return (
    <Ctx.Provider value={{ open: openModal }}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="t-panel w-full max-w-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                else if (e.key === "ArrowDown")
                  setActive((a) => Math.min(results.length - 1, a + 1));
                else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
                else if (e.key === "Enter" && results[active]) go(results[active].symbol);
              }}
              placeholder="Search symbols, indices, macro… (QNBK, QSE, Brent)"
              className="w-full border-b border-terminal-border bg-transparent px-4 py-3 text-sm text-terminal-bright placeholder:text-terminal-muted focus:outline-none"
            />
            <ul className="max-h-80 overflow-y-auto t-scroll">
              {results.length === 0 && query.trim() && (
                <li className="px-4 py-6 text-center text-xs text-terminal-muted">
                  No matches for “{query}”.
                </li>
              )}
              {results.length === 0 && !query.trim() && (
                <li className="px-4 py-6 text-center text-xs text-terminal-muted">
                  Type to search the Qatar &amp; GCC universe.
                </li>
              )}
              {results.map((r, i) => (
                <li key={r.symbol}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.symbol)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                      i === active ? "bg-terminal-accent/15" : "hover:bg-terminal-panel2"
                    }`}
                  >
                    <span className="num w-16 shrink-0 text-xs font-bold text-terminal-bright">
                      {r.symbol}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-terminal-text">
                      {r.name}
                    </span>
                    <span className="t-chip bg-terminal-panel2 text-terminal-muted">
                      {r.market}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 border-t border-terminal-border px-4 py-2 text-[10px] text-terminal-muted">
              <span>
                <span className="kbd">↑</span> <span className="kbd">↓</span> navigate
              </span>
              <span>
                <span className="kbd">↵</span> open
              </span>
              <span>
                <span className="kbd">esc</span> close
              </span>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
