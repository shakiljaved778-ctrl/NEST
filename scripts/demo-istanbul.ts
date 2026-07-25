/**
 * Phase 0 exit test, runnable: the one-sentence Istanbul booking, end-to-end
 * against the mock adapters. `pnpm demo`.
 */
import {
  assembleTrip,
  runCheckout,
  type NarrationEvent,
} from "@voyara/agent-core";
import { MockLodgingAdapter, MockAirAdapter } from "@voyara/inventory-mesh";
import { Ledger, Accounts, transfer } from "@voyara/ledger";
import { formatMoney, money } from "@voyara/contracts";

const SENTENCE =
  "3 nights in Istanbul next weekend, boutique, under $150/night, near Sultanahmet";

async function main() {
  const lodging = new MockLodgingAdapter();
  const air = new MockAirAdapter();

  console.log(`\n✈  VOYARA — intent:\n   "${SENTENCE}"\n`);

  const presentation = await assembleTrip(
    SENTENCE,
    { lodging, air },
    {
      narrate: (e: NarrationEvent) => {
        if (e.type === "narrate") console.log(`   … ${e.message}`);
        if (e.type === "gap") console.log(`   ⚠  ${e.message}`);
      },
    },
  );

  const p = presentation.primary;
  console.log(`\n★ PRIMARY — ${p.label}  (fit ${(p.fitScore * 100).toFixed(0)}%)`);
  console.log(`   ${p.segments.map((s) => s.offer.title).join(" + ")}`);
  console.log(`   ${formatMoney(p.totalPrice)}  ·  verdict ${p.forecast.verdict} (${(p.forecast.confidence * 100).toFixed(0)}% conf)`);
  console.log(`   why: ${p.fitBreakdown.signals.join("; ")}`);
  for (const alt of presentation.alternates) {
    console.log(`   ~ ${alt.label}: ${alt.segments[0]?.offer.title} — ${formatMoney(alt.totalPrice)} [${alt.forecast.verdict}]`);
  }

  // Checkout against the sandbox (mock) supplier + double-entry ledger.
  const ledger = new Ledger();
  // seed a small wallet credit to prove wallet-apply
  ledger.post(
    transfer({
      from: Accounts.voyaraRevenue("savings_fee"),
      to: Accounts.userWallet("demo-user"),
      amount: money(2500, "USD"),
      memo: "seed wallet credit",
    }),
  );

  const result = await runCheckout(
    {
      option: p,
      userId: "demo-user",
      paymentMandate: "pm_tok_test_demo",
      applyWallet: true,
      walletBalance: ledger.balance(Accounts.userWallet("demo-user")),
    },
    {
      lodging,
      air,
      ledger,
      charge: async () => {
        /* mock Stripe test charge — tokenized mandate only */
      },
    },
  );

  console.log(`\n💳 CHECKOUT — ${result.status}  booking ${result.bookingId}`);
  console.log(`   charged ${formatMoney(result.totalCharged)}  ·  wallet applied ${formatMoney(result.walletApplied)}`);
  console.log(`   PNRs: ${JSON.stringify(result.pnrRefs)}`);
  console.log(`   ledger nets to zero: ${ledger.all().reduce((s, x) => s + x.amountMinor, 0) === 0}`);
  console.log("\n✓ Phase 0 exit test passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
