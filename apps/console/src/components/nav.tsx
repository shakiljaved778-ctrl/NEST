"use client";

import { cn } from "@amil/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="mt-8 flex flex-col gap-1 text-sm">
      {items.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 transition",
              active ? "bg-white/15 font-medium" : "opacity-85 hover:bg-white/10",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
