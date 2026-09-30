import { messages } from "@amil/i18n";

const sections = [
  { name: "Dashboard", detail: "Insights shown, responses, reconsidered actions, value protected" },
  { name: "Rule packs", detail: "Enable or disable, parameters with diff and version history" },
  {
    name: "Templates",
    detail: "en/ar editor, banned-term checker, approval workflow, kill switch",
  },
  { name: "Audit", detail: "Search, hash-chain verification, CSV and JSON export" },
  {
    name: "Complaints lookup",
    detail: "Exactly which insights a customer saw and how they responded",
  },
  { name: "Compliance pack", detail: "Model card, data flows, fields per pack, redaction proof" },
];

export default function ConsoleHome() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-brand p-5 text-white">
        <p className="text-lg font-semibold">AMIL Console</p>
        <p className="text-xs opacity-80">Doha Demo Bank (fictional)</p>
        <nav className="mt-8 space-y-2 text-sm opacity-90">
          {sections.map((s) => (
            <p key={s.name}>{s.name}</p>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold">Foundation build (Phase 1)</h1>
        <p className="mt-2 text-ink-muted">These console areas are implemented in Phase 7.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => (
            <div key={s.name} className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="font-medium">{s.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">{s.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-xs text-ink-muted">{messages.en.demo.footer}</p>
      </main>
    </div>
  );
}
