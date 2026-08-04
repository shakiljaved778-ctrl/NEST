"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, LogOut, Settings, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials, titleCase } from "@/lib/utils";
import { CommandK } from "./command-k";
import { useState } from "react";

export function Topbar({
  user,
  unreadCount,
}: {
  user: { name: string; email: string; role: string };
  unreadCount: number;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background px-4">
      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-start">Search leads, clients, deals…</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">⌘K</kbd>
      </button>
      <CommandK open={searchOpen} onOpenChange={setSearchOpen} />
      <div className="ms-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild className="relative">
          <Link href="/notifications" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(user.name || user.email)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
              <div className="mt-1 text-xs font-normal text-muted-foreground">{titleCase(user.role)}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
