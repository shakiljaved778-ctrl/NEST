import Link from "next/link";
import { CommandDeck } from "@/components/CommandDeck";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl tracking-tight text-cream">
            Voyara
          </span>
          <span className="text-xs uppercase tracking-[0.3em] text-gold/70">
            Command Deck
          </span>
        </div>
        <nav className="flex items-center gap-5 text-sm text-cream/60">
          <span className="hidden sm:inline">Autonomy · ACT</span>
          <Link href="/trust" className="hover:text-gold">
            Trust
          </Link>
        </nav>
      </header>

      <p className="mb-6 max-w-2xl text-cream/60">
        An agent with a wallet. State your trip in one sentence — Voyara plans,
        prices with a Buy/Wait verdict, books, and guards it until you are home.
        No results pages. Zero sponsored placement.
      </p>

      <CommandDeck />

      <footer className="mt-12 text-xs text-cream/30">
        Mock suppliers · Stripe test mode · no external keys required. Voyara sells
        outcomes, not shelf space.
      </footer>
    </main>
  );
}
