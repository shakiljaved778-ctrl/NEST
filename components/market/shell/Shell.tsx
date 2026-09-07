"use client";
import { TopBar } from "./TopBar";
import { Nav } from "./Nav";
import { SearchCommandProvider } from "./SearchCommand";
import { Footer } from "@/components/market/ui/Footer";

/** App chrome: top bar, left nav, scrollable content, compliance footer. */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SearchCommandProvider>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <div className="flex flex-1 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-terminal-border p-2 md:w-52 md:border-b-0 md:border-r">
            <Nav />
          </aside>
          <main className="min-w-0 flex-1 overflow-x-hidden p-3 md:p-4">{children}</main>
        </div>
        <Footer />
      </div>
    </SearchCommandProvider>
  );
}
