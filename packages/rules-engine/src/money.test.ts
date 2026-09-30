import { describe, expect, it } from "vitest";
import {
  clamp,
  D,
  max,
  min,
  percentOf,
  proRata,
  round,
  sum,
  toFixedString,
  toMoneyString,
  type RoundingMode,
} from "./money";

describe("D()", () => {
  it("accepts decimal strings and safe integers", () => {
    expect(D("420.10").toString()).toBe("420.1");
    expect(D(42000).toString()).toBe("42000");
    expect(D("-3.5").toString()).toBe("-3.5");
  });

  it.each([0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60])(
    "rejects the non-safe-integer JS number %s",
    (n) => {
      expect(() => D(n)).toThrow(TypeError);
    },
  );

  it.each(["", "abc", "1e3", "1,000.00", " 12..3", "0x10"])(
    "rejects non-decimal string %j",
    (s) => {
      expect(() => D(s)).toThrow(TypeError);
    },
  );

  it("is exact where floats are not: 0.1 + 0.2 = 0.3", () => {
    // In IEEE floats 0.1 + 0.2 = 0.30000000000000004
    expect(D("0.1").plus(D("0.2")).equals(D("0.3"))).toBe(true);
  });
});

describe("round()", () => {
  // Worked examples: the digit after the 2nd decimal decides; exactly-5 ties differ by mode.
  const cases: [string, RoundingMode, string][] = [
    ["2.345", "half_up", "2.35"], // tie -> away from zero
    ["2.345", "half_even", "2.34"], // tie -> even neighbour (4)
    ["2.355", "half_even", "2.36"], // tie -> even neighbour (6)
    ["2.3449", "half_up", "2.34"], // not a tie
    ["-2.345", "half_up", "-2.35"], // symmetric for negatives
    ["-2.345", "half_even", "-2.34"],
    ["419.995", "half_up", "420.00"],
    ["0.005", "half_even", "0.00"],
  ];
  it.each(cases)("round(%s, %s) = %s", (input, mode, expected) => {
    expect(toMoneyString(round(D(input), mode))).toBe(expected);
  });

  it("defaults to half-up at 2 dp", () => {
    expect(toMoneyString(round(D("10.125")))).toBe("10.13");
  });
});

describe("aggregates", () => {
  it("sums exactly", () => {
    // 3 x 33.33 + 0.01 = 100.00
    expect(toMoneyString(sum([D("33.33"), D("33.33"), D("33.33"), D("0.01")]))).toBe("100.00");
    expect(toMoneyString(sum([]))).toBe("0.00");
  });

  it("min / max / clamp", () => {
    expect(min(D("5"), D("3"), D("4")).toString()).toBe("3");
    expect(max(D("5"), D("3"), D("9")).toString()).toBe("9");
    // Fee 1% of 120,000 = 1,200, capped at 1,000
    expect(clamp(D("1200"), D("100"), D("1000")).toString()).toBe("1000");
    // Fee 1% of 5,000 = 50, floored at 100
    expect(clamp(D("50"), D("100"), D("1000")).toString()).toBe("100");
    expect(clamp(D("500")).toString()).toBe("500");
  });
});

describe("percentOf / proRata", () => {
  it("percentOf: 3% cash advance fee on QAR 1,250 = 37.50", () => {
    expect(toMoneyString(percentOf(D("1250"), D("3")))).toBe("37.50");
  });

  it("percentOf: 42,000 points x QAR 0.01 via 1% = 420.00", () => {
    expect(toMoneyString(percentOf(D("42000"), D("1")))).toBe("420.00");
  });

  it("proRata: annual fee 1,500 refunded for 10 of 12 unused months = 1,250.00", () => {
    expect(toMoneyString(proRata(D("1500"), D("10"), D("12")))).toBe("1250.00");
  });

  it("proRata: 1,000 x 1/3 keeps precision until rounding (333.33)", () => {
    const v = proRata(D("1000"), D("1"), D("3"));
    expect(v.toString().startsWith("333.3333333")).toBe(true);
    expect(toMoneyString(v)).toBe("333.33");
  });

  it("proRata rejects a zero denominator", () => {
    expect(() => proRata(D("1"), D("1"), D("0"))).toThrow(RangeError);
  });

  it("toFixedString for rates and point values", () => {
    expect(toFixedString(D("0.01"), 4)).toBe("0.0100");
    expect(toFixedString(D("5.49995"), 4)).toBe("5.5000");
  });
});
