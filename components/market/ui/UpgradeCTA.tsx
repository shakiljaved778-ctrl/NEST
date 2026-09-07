"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAppState } from "@/components/market/providers/AppState";

/** Inline upgrade prompt shown when a free user hits a limit. */
export function UpgradeCTA({
  feature,
  children,
  compact = false,
}: {
  feature: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const { track } = useAppState();
  if (compact) {
    return (
      <Link
        href="/markets/upgrade"
        onClick={() => track("click_upgrade", { feature })}
        className="t-btn-gold"
      >
        ★ Upgrade
      </Link>
    );
  }
  return (
    <div className="rounded-md border border-terminal-warn/30 bg-terminal-warn/5 p-3 text-center">
      <p className="text-xs text-terminal-text">
        {children ?? `${feature} is a Premium feature.`}
      </p>
      <Link
        href="/markets/upgrade"
        onClick={() => track("click_upgrade", { feature })}
        className="t-btn-gold mt-2"
      >
        ★ Upgrade to Premium
      </Link>
    </div>
  );
}

/**
 * Lock overlay for premium-only panels. Renders children blurred behind a
 * frosted CTA. Used for advanced analytics / live streaming / macro depth.
 */
export function LockOverlay({
  feature,
  message,
  children,
}: {
  feature: string;
  message?: string;
  children: ReactNode;
}) {
  const { track } = useAppState();
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-terminal-bg/60 p-4 text-center backdrop-blur-[1px]">
        <span className="t-chip bg-terminal-warn/15 text-terminal-warn">★ Premium</span>
        <p className="max-w-xs text-xs text-terminal-text">
          {message ?? `Unlock ${feature} with Premium.`}
        </p>
        <Link
          href="/markets/upgrade"
          onClick={() => track("click_upgrade", { feature })}
          className="t-btn-gold"
        >
          Upgrade
        </Link>
      </div>
    </div>
  );
}
