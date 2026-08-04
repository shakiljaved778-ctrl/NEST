"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Landmark,
  Sun,
  Users,
  Handshake,
  Building2,
  CheckSquare,
  BarChart3,
  Settings2,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/my-day", label: "My Day", icon: Sun },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = [...NAV];
  if (role === "ADMIN") items.push({ href: "/admin", label: "Admin", icon: Settings2 });

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed bottom-4 start-4 z-40 rounded-full bg-primary p-3 text-primary-foreground shadow-lg md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-30 w-56 shrink-0 border-e bg-background transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Landmark className="h-4 w-4" />
          </div>
          <span className="font-semibold">Fintech CRM</span>
        </div>
        <nav className="space-y-1 p-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
