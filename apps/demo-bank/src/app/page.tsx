import { messages } from "@amil/i18n";
import { PhoneFrame } from "./phone-frame";

const screens = [
  "Home: accounts, cards, finance, deposits",
  "Card detail with the Close card flow",
  "Finance detail with the Settle early flow",
  "Deposit detail with the Break deposit flow",
  "Statement with tappable charges",
  "Alerts inbox and Ask AMIL",
];

export default function Home() {
  return (
    <PhoneFrame>
      <header className="bg-brand px-5 pb-6 pt-4 text-brand-contrast">
        <p className="text-xs uppercase tracking-widest opacity-80">Doha Demo Bank</p>
        <h1 className="mt-1 text-2xl font-semibold">Welcome</h1>
        <p className="mt-1 text-sm opacity-80">بنك الدوحة التجريبي</p>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto bg-surface-muted px-5 py-5">
        <section className="rounded-[var(--ddb-radius)] bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Foundation build (Phase 1)</h2>
          <p className="mt-1 text-sm text-ink-muted">
            The banking screens and the AMIL insight widget arrive in Phase 4. These are planned:
          </p>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-ink-muted">
            {screens.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="shrink-0 border-t border-black/5 bg-surface px-5 py-3 text-center text-[11px] text-ink-muted">
        <p>{messages.en.demo.footer}</p>
        <p dir="rtl" lang="ar">
          {messages.ar.demo.footer}
        </p>
      </footer>
    </PhoneFrame>
  );
}
