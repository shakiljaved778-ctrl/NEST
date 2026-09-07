"use client";

/**
 * Mini visual previews of each design direction, drawn in CSS so the client
 * can *see* the style, not just read a label. Selecting sets the value.
 */

type StyleId = "minimal" | "bold" | "warm" | "corporate";

function Preview({ id }: { id: StyleId }) {
  switch (id) {
    case "minimal":
      return (
        <div className="h-full w-full rounded-md p-3" style={{ background: "#0b1b33" }}>
          <div className="h-1.5 w-8 rounded-full" style={{ background: "#c9a24b" }} />
          <div className="mt-4 h-2 w-3/4 rounded-full bg-white/70" />
          <div className="mt-1.5 h-2 w-1/2 rounded-full bg-white/30" />
          <div className="mt-4 h-4 w-14 rounded-full" style={{ background: "#c9a24b" }} />
        </div>
      );
    case "bold":
      return (
        <div className="h-full w-full rounded-md p-3" style={{ background: "#111" }}>
          <div className="h-3 w-full rounded-sm" style={{ background: "#ff4d2e" }} />
          <div className="mt-2 h-4 w-2/3 rounded-sm bg-white" />
          <div className="mt-1 h-4 w-1/2 rounded-sm" style={{ background: "#ffd23f" }} />
        </div>
      );
    case "warm":
      return (
        <div className="h-full w-full rounded-md p-3" style={{ background: "#3b2a1a" }}>
          <div className="mx-auto h-2 w-10 rounded-full" style={{ background: "#d9b382" }} />
          <div className="mx-auto mt-3 h-2 w-2/3 rounded-full bg-[#e9dcc4]" />
          <div className="mx-auto mt-1.5 h-2 w-1/2 rounded-full bg-[#e9dcc4]/60" />
          <div className="mx-auto mt-3 h-4 w-16 rounded-full" style={{ background: "#8a5a2b" }} />
        </div>
      );
    case "corporate":
      return (
        <div className="h-full w-full rounded-md p-3" style={{ background: "#fff" }}>
          <div className="flex items-center justify-between">
            <div className="h-2 w-10 rounded-sm" style={{ background: "#1f4e8c" }} />
            <div className="h-2 w-6 rounded-sm bg-slate-300" />
          </div>
          <div className="mt-4 h-2 w-3/4 rounded-full bg-slate-700" />
          <div className="mt-1.5 h-2 w-1/2 rounded-full bg-slate-300" />
          <div className="mt-3 h-4 w-14 rounded-sm" style={{ background: "#1f4e8c" }} />
        </div>
      );
  }
}

export default function StyleTile({
  id,
  name,
  desc,
  selected,
  onSelect,
}: {
  id: StyleId;
  name: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group rounded-xl2 border p-3 text-left transition ${
        selected
          ? "border-gold bg-gold/[0.08] ring-1 ring-gold"
          : "border-white/12 bg-white/[0.03] hover:border-gold/40"
      }`}
    >
      <div className="aspect-[4/3] overflow-hidden rounded-md">
        <Preview id={id} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <h4 className="font-display text-base">{name}</h4>
        <span
          className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
            selected ? "border-gold bg-gold text-navy-800" : "border-white/25 text-transparent"
          }`}
        >
          ✓
        </span>
      </div>
      <p className="mt-1 text-xs text-cream/60">{desc}</p>
    </button>
  );
}
