"use client";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/market/providers/AppState";
import { PLAN_FEATURES } from "@/lib/market/plan";

const ROWS: { label: string; free: string; premium: string }[] = [
  { label: "Quote latency", free: "15-min delayed", premium: "Near real-time" },
  { label: "Live streaming", free: "—", premium: "SSE / WebSocket" },
  { label: "Chart indicators", free: "1", premium: "Up to 6 + drawings" },
  { label: "Portfolios", free: "1", premium: "Up to 10" },
  { label: "Portfolio analytics", free: "Basic P&L", premium: "Risk + scenarios" },
  { label: "Price / % alerts", free: "—", premium: "Included" },
  { label: "GCC + global macro depth", free: "—", premium: "Full" },
  { label: "Deeper fundamentals", free: "Core stats", premium: "EPS, beta, book value" },
];

export default function UpgradePage() {
  const { user, plan, setPlan, track } = useAppState();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold text-terminal-bright">Qatar Markets Premium</h1>
        <p className="text-xs text-terminal-muted">
          Near real-time data, advanced charts &amp; analytics, alerts, and full macro depth.
        </p>
      </div>

      <div className="t-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-terminal-border text-xs uppercase tracking-wide text-terminal-muted">
              <th className="px-4 py-3 text-left font-semibold">Feature</th>
              <th className="px-4 py-3 text-center font-semibold">Free</th>
              <th className="px-4 py-3 text-center font-semibold text-terminal-warn">★ Premium</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-b border-terminal-border/60">
                <td className="px-4 py-2.5 text-terminal-text">{r.label}</td>
                <td className="px-4 py-2.5 text-center text-terminal-muted">{r.free}</td>
                <td className="px-4 py-2.5 text-center font-semibold text-terminal-bright">
                  {r.premium}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        {!user ? (
          <button onClick={() => router.push("/markets/login")} className="t-btn-accent px-6 py-2.5">
            Sign in to upgrade
          </button>
        ) : plan === "premium" ? (
          <>
            <p className="text-sm text-terminal-up">✓ You’re on Premium.</p>
            <button onClick={() => setPlan("free")} className="t-btn">
              Downgrade to Free (demo)
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                track("click_upgrade", { source: "upgrade_page" });
                // DEMO: flip the plan locally. In production this redirects to
                // Stripe/Paddle checkout; the webhook (see app/api/market/billing)
                // flips the Subscription record on payment success.
                setPlan("premium");
              }}
              className="t-btn-gold px-6 py-2.5 text-sm"
            >
              ★ Start Premium — QAR 49 / mo (demo)
            </button>
            <p className="text-[11px] text-terminal-muted">
              Demo checkout — no payment is taken. Stripe/Paddle integration is stubbed.
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[10px] text-terminal-muted">
        Delay on Free tier: {PLAN_FEATURES.free.quoteDelayMinutes} min · Premium:{" "}
        {PLAN_FEATURES.premium.quoteDelayMinutes === 0
          ? "near real-time"
          : `${PLAN_FEATURES.premium.quoteDelayMinutes} min`}
      </p>
    </div>
  );
}
