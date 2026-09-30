import type { ReactNode } from "react";

/** Renders children inside a phone-shaped frame on desktop; full-bleed on small screens. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center sm:p-8">
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-surface sm:h-[844px] sm:w-[390px] sm:rounded-[48px] sm:border-[12px] sm:border-neutral-900 sm:shadow-2xl">
        <div className="hidden h-7 shrink-0 items-center justify-center sm:flex" aria-hidden>
          <div className="h-5 w-28 rounded-full bg-neutral-900" />
        </div>
        {children}
      </div>
    </div>
  );
}
