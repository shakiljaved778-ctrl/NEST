import { describe, it, expect } from "vitest";
import { evaluatePriceDrop, evaluateDisruption, SUCCESS_FEE_BPS } from "./index.js";
import { money } from "@voyara/contracts";

describe("guardian remediation", () => {
  it("computes a 20% success fee on a documented price-drop saving", () => {
    const r = evaluatePriceDrop(money(10000, "USD"), money(8600, "USD"), "ASK", 20000);
    expect(r.savings?.amountMinor).toBe(1400);
    expect(r.successFee?.amountMinor).toBe(Math.round((1400 * SUCCESS_FEE_BPS) / 10000));
    expect(r.execute).toBe(true); // refundable rebook, ASK may auto-execute
  });

  it("does not auto-execute a price drop for a WATCH-tier user", () => {
    const r = evaluatePriceDrop(money(10000, "USD"), money(9000, "USD"), "WATCH", 20000);
    expect(r.execute).toBe(false);
  });

  it("respects the ACT cap when auto-rebooking", () => {
    const under = evaluatePriceDrop(money(30000, "USD"), money(9000, "USD"), "ACT", 20000);
    expect(under.execute).toBe(true);
    const over = evaluatePriceDrop(money(60000, "USD"), money(45000, "USD"), "ACT", 20000);
    expect(over.execute).toBe(false); // new price exceeds cap
  });

  it("auto-holds a disruption alternative only above WATCH", () => {
    expect(evaluateDisruption("DELAY", "21:40", "WATCH").execute).toBe(false);
    expect(evaluateDisruption("DELAY", "21:40", "ASK").execute).toBe(true);
  });
});
