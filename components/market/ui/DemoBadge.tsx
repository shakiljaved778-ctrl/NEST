"use client";

/**
 * "Demo data" marker — shown wherever simulated data is displayed so users are
 * never misled (compliance requirement). Hidden automatically when a real feed
 * is connected (isMock=false).
 */
export function DemoBadge({
  isMock = true,
  label = "Demo data",
  className = "",
}: {
  isMock?: boolean;
  label?: string;
  className?: string;
}) {
  if (!isMock) return null;
  return (
    <span
      title="Simulated data for demonstration. Connect a live API for real quotes."
      className={`t-chip border border-terminal-warn/40 bg-terminal-warn/10 text-terminal-warn ${className}`}
    >
      ◆ {label}
    </span>
  );
}
