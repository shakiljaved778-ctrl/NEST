"use client";
import type { ReactNode } from "react";

/** Standard dashboard panel: titled, bordered, optional header actions. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`t-panel flex flex-col ${className}`}>
      {(title || actions) && (
        <header className="t-panel-head">
          <div className="min-w-0">
            {title && <h2 className="t-title truncate">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] text-terminal-muted">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName || "p-3"}`}>{children}</div>
    </section>
  );
}
