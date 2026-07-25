import Link from "next/link";

export default function TrustPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/" className="text-sm text-gold/70 hover:text-gold">
        ← Command Deck
      </Link>
      <h1 className="font-display text-4xl text-cream mt-6">
        Zero sponsored results. Ever.
      </h1>
      <p className="mt-4 text-cream/70 leading-relaxed">
        Booking.com sells shelf space. Hopper sells fintech. Voyara sells
        outcomes: a guarded trip at the right price. Ranking is by fit score
        only — and that is enforced in code, not policy.
      </p>

      <section className="mt-8 rounded-2xl bg-navy-900/60 ring-1 ring-white/5 p-6">
        <h2 className="font-display text-2xl text-cream">How fit scoring works</h2>
        <p className="mt-3 text-cream/70">
          Every option is scored from five traveler signals, weighted:
        </p>
        <ul className="mt-3 space-y-1 text-cream/80">
          <li>Taste-graph match — 32%</li>
          <li>Price vs. your budget — 22%</li>
          <li>Location / neighborhood fit — 22%</li>
          <li>Review quality — 14%</li>
          <li>Schedule quality — 10%</li>
        </ul>
        <p className="mt-4 text-cream/70">
          There is <span className="text-gold">no field</span> in the scoring
          function where a supplier can pay for position. The input type carries
          no margin, commission, or sponsorship signal, and a unit test asserts
          that a smuggled margin value can never change a score. This is the
          trust moat, enforced mechanically.
        </p>
        <p className="mt-3 text-xs text-rebate/80 font-mono">
          packages/agent-core/src/fit-score.test.ts → “a smuggled supplier-margin
          field cannot change the score”
        </p>
      </section>

      <section className="mt-6 grid sm:grid-cols-2 gap-4">
        {[
          ["Delegation, not search", "Intent in → one assembled trip + two alternates out."],
          ["Predictive prices", "Every fare carries an ML Buy/Wait verdict with confidence."],
          ["Book and guard", "A daemon monitors every live trip and remediates within your consent tier."],
          ["Machine demand", "The whole booking engine is exposed as MCP rails, billed per booking."],
        ].map(([h, b]) => (
          <div key={h} className="rounded-xl bg-navy-900/50 ring-1 ring-white/5 p-4">
            <div className="text-gold font-semibold">{h}</div>
            <div className="text-sm text-cream/60 mt-1">{b}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
