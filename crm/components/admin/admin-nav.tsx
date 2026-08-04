"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/pipelines", label: "Pipelines" },
  { href: "/admin/routing", label: "Routing & SLA" },
  { href: "/admin/kyc", label: "KYC checklist" },
  { href: "/admin/custom-fields", label: "Custom fields" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/recycle-bin", label: "Recycle bin" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 border-b pb-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
