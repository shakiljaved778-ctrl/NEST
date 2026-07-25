import { describe, it, expect } from "vitest";
import { assembleTrip, runCheckout } from "@voyara/agent-core";
import { MockLodgingAdapter, MockAirAdapter } from "@voyara/inventory-mesh";
import { Ledger } from "@voyara/ledger";
import { money } from "@voyara/contracts";

const SENTENCE =
  "3 nights in Istanbul next weekend, boutique, under $150/night, near Sultanahmet";

describe("Phase 0 exit test — one-sentence Istanbul booking", () => {
  it("assembles exactly 1 primary + up to 2 alternates with a verdict", async () => {
    const presentation = await assembleTrip(SENTENCE, {
      lodging: new MockLodgingAdapter(),
      air: new MockAirAdapter(),
    });
    expect(presentation.primary).toBeTruthy();
    expect(presentation.alternates.length).toBeLessThanOrEqual(2);
    expect(presentation.alternates.length).toBeGreaterThanOrEqual(1);
    // hotel-only: single hotel segment, in Istanbul, under $150/night
    const hotel = presentation.primary.segments.find((s) => s.kind === "HOTEL");
    expect(hotel?.offer.city).toBe("Istanbul");
    expect(hotel?.offer.perNight?.amountMinor).toBeLessThanOrEqual(15000);
    expect(["BUY", "WAIT"]).toContain(presentation.primary.forecast.verdict);
    expect(presentation.primary.fitScore).toBeGreaterThan(0);
  });

  it("prefers a boutique Sultanahmet stay for the primary", async () => {
    const presentation = await assembleTrip(SENTENCE, {
      lodging: new MockLodgingAdapter(),
    });
    const hotel = presentation.primary.segments[0]!.offer;
    expect(hotel.style).toContain("boutique");
  });

  it("checks out end-to-end against the mock supplier with a balanced ledger", async () => {
    const lodging = new MockLodgingAdapter();
    const presentation = await assembleTrip(SENTENCE, { lodging });
    const ledger = new Ledger();
    const result = await runCheckout(
      {
        option: presentation.primary,
        userId: "u1",
        paymentMandate: "pm_tok_test",
        applyWallet: false,
        walletBalance: money(0, "USD"),
      },
      { lodging, ledger, charge: async () => {} },
    );
    expect(result.status).toBe("CONFIRMED");
    expect(Object.keys(result.pnrRefs).length).toBeGreaterThan(0);
    expect(ledger.all().reduce((s, p) => s + p.amountMinor, 0)).toBe(0);
  });
});
