import { DEMO_DISCLAIMER_EN } from "@amil/ui";
import type { ReactNode } from "react";
import { Nav, type NavItem } from "@/components/nav";
import { ROLE_LABELS } from "@/lib/labels";
import { can, requireUser } from "@/lib/session";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

const NAV: (NavItem & { permission: string })[] = [
  { href: "/", label: "Dashboard", permission: "dashboard:read" },
  { href: "/packs", label: "Rule packs", permission: "packs:read" },
  { href: "/templates", label: "Templates", permission: "templates:read" },
  { href: "/audit", label: "Audit", permission: "audit:read" },
  { href: "/complaints", label: "Complaints lookup", permission: "complaints:read" },
  { href: "/compliance", label: "Compliance pack", permission: "compliance:read" },
  { href: "/activity", label: "Console activity", permission: "audit:read" },
];

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const me = await requireUser();
  const items = NAV.filter((n) => can(me, n.permission)).map(({ href, label }) => ({
    href,
    label,
  }));
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-brand p-5 text-white print:hidden">
        <p className="text-lg font-semibold">AMIL Console</p>
        <p className="text-xs opacity-80">Doha Demo Bank (fictional)</p>
        <Nav items={items} />
        <div className="mt-auto border-t border-white/20 pt-4 text-xs">
          <p className="font-medium" data-testid="signed-in-user">
            {me.user.name}
          </p>
          <p className="opacity-80">{ROLE_LABELS[me.user.role]?.title}</p>
          <form action={signOut}>
            <button type="submit" className="mt-2 underline opacity-90 hover:opacity-100">
              Switch user
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-8">{children}</main>
        <footer className="px-8 pb-6 text-xs text-ink-muted">{DEMO_DISCLAIMER_EN}</footer>
      </div>
    </div>
  );
}
