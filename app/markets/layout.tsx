import type { Metadata } from "next";
import { AppStateProvider } from "@/components/market/providers/AppState";
import { Shell } from "@/components/market/shell/Shell";

export const metadata: Metadata = {
  title: "Qatar Market Dashboard — QE, GCC & macro for retail investors",
  description:
    "A Bloomberg-style, Qatar-focused market data dashboard: QE quotes & charts, QCB macro, GCC + global context, and a portfolio tracker with rebalancing. Demo data until live APIs are connected.",
};

/**
 * Root layout for the Qatar Market Dashboard. Establishes the dark "terminal"
 * theme (scoped via .terminal-root so it doesn't affect the rest of the app),
 * wires client-side app state, and renders the shell.
 */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="terminal-root min-h-screen">
      <AppStateProvider>
        <Shell>{children}</Shell>
      </AppStateProvider>
    </div>
  );
}
