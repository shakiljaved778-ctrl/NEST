"use client";

/**
 * Reusable phone chrome for the customer & provider prototypes —
 * a device frame with a status bar, matching the wireframe presentation.
 */
export default function PhoneFrame({
  children,
  dir = "ltr",
  accent = "light",
}: {
  children: React.ReactNode;
  dir?: "ltr" | "rtl";
  accent?: "light" | "navy";
}) {
  return (
    <div className="relative mx-auto w-[375px] max-w-full">
      <div className="rounded-[2.6rem] border-[10px] border-navy-900 bg-navy-900 shadow-phone overflow-hidden">
        <div
          dir={dir}
          className={`relative h-[740px] flex flex-col overflow-hidden rounded-[2rem] ${
            accent === "navy" ? "bg-navy-800 text-white" : "bg-pearl text-ink"
          }`}
        >
          {/* status bar */}
          <div
            className={`flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold ${
              accent === "navy" ? "text-white/80" : "text-navy-700"
            }`}
          >
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span>Ooredoo</span>
              <span>▮▮▮</span>
              <span>🔋</span>
            </span>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
        </div>
      </div>
      {/* notch */}
      <div className="pointer-events-none absolute top-[10px] left-1/2 -translate-x-1/2 h-6 w-32 rounded-b-2xl bg-navy-900" />
    </div>
  );
}
