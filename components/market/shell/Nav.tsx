"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/markets", label: "Dashboard", icon: "▤", hint: "g d" },
  { href: "/markets/macro", label: "Macro", icon: "📈", hint: "g m" },
  { href: "/markets/portfolio", label: "Portfolio", icon: "◧", hint: "g p" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 md:flex-col md:items-stretch md:gap-1">
      {LINKS.map((l) => {
        const active =
          l.href === "/markets"
            ? pathname === "/markets"
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`group flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition ${
              active
                ? "bg-terminal-accent/15 text-terminal-bright"
                : "text-terminal-muted hover:bg-terminal-panel2 hover:text-terminal-text"
            }`}
          >
            <span className="text-sm leading-none opacity-80">{l.icon}</span>
            <span>{l.label}</span>
            <span className="kbd ml-auto hidden md:inline-flex">{l.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
