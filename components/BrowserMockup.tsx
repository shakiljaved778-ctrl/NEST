import type { MockupTheme } from "@/data/content";

/**
 * A styled browser-chrome frame containing a CSS-drawn website preview.
 * Each industry gets a distinct, plausible layout + palette so cards read
 * as real project mockups — not stock screenshots. Swap for real captures
 * by setting the project's `isDemo` to false and dropping in an <Image />.
 */

const themes: Record<
  MockupTheme,
  { bg: string; accent: string; text: string; url: string; render: () => React.ReactNode }
> = {
  restaurant: {
    bg: "#1a120b",
    accent: "#d9a441",
    text: "#f5ece0",
    url: "albahr-seafood.qa",
    render: () => (
      <>
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-16 rounded-full" style={{ background: "#d9a441" }} />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1.5 w-6 rounded-full bg-white/20" />
            ))}
          </div>
        </div>
        <div className="mt-4 h-16 rounded-md" style={{ background: "linear-gradient(120deg,#3a2510,#1a120b)" }} />
        <div className="mt-2 h-2 w-3/4 rounded-full bg-white/25" />
        <div className="mt-1.5 h-2 w-1/2 rounded-full bg-white/15" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square rounded-md" style={{ background: "rgba(217,164,65,0.18)" }} />
          ))}
        </div>
      </>
    ),
  },
  clinic: {
    bg: "#eef5f6",
    accent: "#2f9e9b",
    text: "#123",
    url: "pearldental.qa",
    render: () => (
      <>
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-20 rounded-full" style={{ background: "#2f9e9b" }} />
          <div className="h-5 w-14 rounded-full" style={{ background: "#2f9e9b" }} />
        </div>
        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <div className="h-2 w-full rounded-full" style={{ background: "#123", opacity: 0.7 }} />
            <div className="mt-1.5 h-2 w-2/3 rounded-full bg-black/20" />
            <div className="mt-4 h-6 w-24 rounded-md" style={{ background: "#2f9e9b" }} />
          </div>
          <div className="h-20 w-24 rounded-lg" style={{ background: "#cfe7e6" }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded-md bg-black/5" />
          ))}
        </div>
      </>
    ),
  },
  realestate: {
    bg: "#0f1620",
    accent: "#c8a35a",
    text: "#eef",
    url: "lusailrealty.qa",
    render: () => (
      <>
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-24 rounded-full" style={{ background: "#c8a35a" }} />
          <div className="h-1.5 w-10 rounded-full bg-white/20" />
        </div>
        <div className="mt-3 h-24 rounded-lg" style={{ background: "linear-gradient(160deg,#243449,#0f1620)" }}>
          <div className="p-3">
            <div className="h-2 w-1/2 rounded-full" style={{ background: "#c8a35a" }} />
            <div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-white/30" />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 rounded-md bg-white/5 p-1.5">
              <div className="h-1.5 w-2/3 rounded-full bg-white/25" />
            </div>
          ))}
        </div>
      </>
    ),
  },
  retail: {
    bg: "#f4f1ec",
    accent: "#1f3a5f",
    text: "#1f3a5f",
    url: "gulftrading.qa",
    render: () => (
      <>
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-20 rounded-sm" style={{ background: "#1f3a5f" }} />
          <div className="h-5 w-16 rounded-sm" style={{ background: "#1f3a5f" }} />
        </div>
        <div className="mt-3 h-2 w-1/2 rounded-full bg-black/40" />
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-sm border border-black/10 bg-white" />
          ))}
        </div>
      </>
    ),
  },
  professional: {
    bg: "#101826",
    accent: "#9db4d4",
    text: "#dce6f2",
    url: "meridianadvisory.qa",
    render: () => (
      <>
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-24 rounded-sm bg-white/80" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1.5 w-6 rounded-full bg-white/25" />
            ))}
          </div>
        </div>
        <div className="mt-5 h-2.5 w-3/4 rounded-full bg-white/70" />
        <div className="mt-2 h-2 w-1/2 rounded-full bg-white/30" />
        <div className="mt-5 h-7 w-28 rounded-sm" style={{ background: "#9db4d4" }} />
      </>
    ),
  },
  salon: {
    bg: "#231820",
    accent: "#e0a6b3",
    text: "#f7eef1",
    url: "elanbeauty.qa",
    render: () => (
      <>
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-16 rounded-full" style={{ background: "#e0a6b3" }} />
          <div className="h-5 w-16 rounded-full" style={{ background: "#e0a6b3" }} />
        </div>
        <div className="mt-4 h-14 rounded-lg" style={{ background: "linear-gradient(120deg,#3a2833,#231820)" }} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-md p-2" style={{ background: "rgba(224,166,179,0.15)" }}>
              <div className="h-1.5 w-full rounded-full bg-white/25" />
              <div className="mt-1 h-1.5 w-1/2 rounded-full" style={{ background: "#e0a6b3" }} />
            </div>
          ))}
        </div>
      </>
    ),
  },
};

export default function BrowserMockup({
  theme,
  className = "",
}: {
  theme: MockupTheme;
  className?: string;
}) {
  const t = themes[theme];
  return (
    <div className={`overflow-hidden rounded-lg border border-white/10 shadow-card ${className}`} dir="ltr">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 bg-navy-900 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 flex-1 truncate rounded-full bg-white/10 px-3 py-1 text-[10px] text-cream/60">
          {t.url}
        </span>
      </div>
      {/* Page preview */}
      <div className="p-4" style={{ background: t.bg, color: t.text }}>
        {t.render()}
      </div>
    </div>
  );
}
