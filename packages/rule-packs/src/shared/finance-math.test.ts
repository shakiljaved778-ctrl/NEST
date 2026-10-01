import { D } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import { amortiseRevolving, annuityInstalment, flatInstalment } from "./finance-math";

describe("annuityInstalment", () => {
  it.each([
    // 10,000 × 0.01 / (1 − 1.01^−12) = 888.4879 -> 888.49
    ["10000.00", "12", 12, "888.49"],
    // 3,036.64 over 12 months at 12%: 269.80; over 2 months: 1,541.13
    ["3036.64", "12", 12, "269.80"],
    ["3036.64", "12", 2, "1541.13"],
    // zero rate: straight division
    ["1200.00", "0", 12, "100.00"],
  ])("%s at %s%% over %d months = %s", (p, rate, n, expected) => {
    expect(annuityInstalment(D(p), D(rate), n, "half_up").toFixed(2)).toBe(expected);
  });

  it("rejects a non-positive term", () => {
    expect(() => annuityInstalment(D(1), D(1), 0, "half_up")).toThrow(RangeError);
  });
});

describe("flatInstalment", () => {
  it("prices profit on the cost for the whole term", () => {
    // 12,000 × 5% × 12/12 = 600; (12,000 + 600) / 12 = 1,050
    const r = flatInstalment(D("12000"), D("5"), 12, "half_up");
    expect([r.profit.toFixed(2), r.instalment.toFixed(2)]).toEqual(["600.00", "1050.00"]);
  });

  it("rejects a non-positive term", () => {
    expect(() => flatInstalment(D(1), D(1), -1, "half_up")).toThrow(RangeError);
  });
});

describe("amortiseRevolving", () => {
  it("takes the payment first, then charges on the remainder", () => {
    // m1 1,000 − 500 = 500 + 10.00; m2 510 − 500 = 10 + 0.20; m3 pays 10.20
    const r = amortiseRevolving(D("1000"), {
      payment: () => D("500"),
      aprPct: D("24"),
      maxMonths: 600,
      mode: "half_up",
    });
    expect([r.months, r.totalPaid.toFixed(2), r.totalInterest.toFixed(2), r.clears]).toEqual([
      3,
      "1010.20",
      "10.20",
      true,
    ]);
  });

  it("stops at maxMonths when the payment does not keep up", () => {
    // 10/month against 20.00 of monthly charges on 1,000 at 24%
    const r = amortiseRevolving(D("1000"), {
      payment: () => D("10"),
      aprPct: D("24"),
      maxMonths: 24,
      mode: "half_up",
    });
    expect(r.months).toBe(24);
    expect(r.clears).toBe(false);
  });
});
