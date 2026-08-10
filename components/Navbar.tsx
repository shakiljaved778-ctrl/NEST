"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLang } from "./LanguageProvider";

const links = [
  { href: "/", key: "nav.home" as const },
  { href: "/work", key: "nav.work" as const },
  { href: "/services", key: "nav.services" as const },
  { href: "/about", key: "nav.about" as const },
  { href: "/contact", key: "nav.contact" as const },
];

export default function Navbar() {
  const { t, toggle } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy/80 backdrop-blur-md">
      <nav className="wrap flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
          onClick={() => setOpen(false)}
        >
          <span className="grid h-8 w-8 place-items-center rounded-md border border-gold/50 text-gold">
            Q
          </span>
          <span>
            Qatar<span className="text-gold">Store</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`link-underline text-sm ${
                  active ? "text-gold" : "text-cream/80 hover:text-cream"
                }`}
              >
                {t(l.key)}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label="Switch language"
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-cream/90 transition hover:border-gold hover:text-gold"
          >
            {t("nav.lang")}
          </button>
          <Link href="/start" className="btn-gold hidden text-xs sm:inline-flex">
            {t("nav.start")}
          </Link>
          <button
            className="md:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="block h-5 w-6">
              <span
                className={`block h-0.5 w-6 bg-cream transition ${open ? "translate-y-2 rotate-45" : ""}`}
              />
              <span
                className={`mt-1.5 block h-0.5 w-6 bg-cream transition ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`mt-1.5 block h-0.5 w-6 bg-cream transition ${open ? "-translate-y-2 -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 bg-navy/95 md:hidden">
          <div className="wrap flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-cream/90 hover:bg-white/5"
              >
                {t(l.key)}
              </Link>
            ))}
            <Link
              href="/start"
              onClick={() => setOpen(false)}
              className="btn-gold mt-2 w-full"
            >
              {t("nav.start")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
