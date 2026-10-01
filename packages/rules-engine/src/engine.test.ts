import { describe, expect, it } from "vitest";
import { CONTINUE_OPTIONS } from "./contract";
import { FactBuilder } from "./facts";
import { D } from "./money";
import { maxSeverity, severityForAmount } from "./severity";

const thresholds = { cautionAtQar: "50.00", criticalAtQar: "250.00" };

describe("severityForAmount (caution 50, critical 250)", () => {
  it.each([
    ["0.00", "info"],
    ["49.99", "info"],
    ["50.00", "caution"], // threshold is inclusive
    ["249.99", "caution"],
    ["250.00", "critical"],
    ["420.00", "critical"], // Khalid's 42,000 points x 0.01
  ] as const)("%s -> %s", (amount, expected) => {
    expect(severityForAmount(D(amount), thresholds)).toBe(expected);
  });
});

describe("maxSeverity", () => {
  it.each([
    [[], "info"],
    [["info", "caution"], "caution"],
    [["critical", "info"], "critical"],
    [["caution", "caution"], "caution"],
  ] as const)("%j -> %s", (input, expected) => {
    expect(maxSeverity(...input)).toBe(expected);
  });
});

describe("FactBuilder", () => {
  it("builds facts with sources and de-duplicated _sources", () => {
    const facts = new FactBuilder<"a" | "b" | "c">()
      .add("a", "42000", "points", "rewards_ledger", "2026-09-30")
      .add("b", "420.00", "QAR", "rewards_ledger", "2026-09-30")
      .add("c", "6250.00", "QAR", "card", "2026-09-30")
      .build();
    expect(facts.a).toEqual({
      key: "a",
      value: "42000",
      unit: "points",
      source: "rewards_ledger",
      asOf: "2026-09-30",
    });
    expect(facts._sources).toEqual([
      { source: "rewards_ledger", asOf: "2026-09-30" },
      { source: "card", asOf: "2026-09-30" },
    ]);
  });

  it("rejects duplicate fact keys", () => {
    const b = new FactBuilder<"a">().add("a", "1", "count", "computed", "2026-09-30");
    expect(() => b.add("a", "2", "count", "computed", "2026-09-30")).toThrow(/Duplicate/);
  });
});

describe("CONTINUE_OPTIONS", () => {
  it("follows the naming the widget relies on: continue_* plus the flagship settle_now", () => {
    for (const key of CONTINUE_OPTIONS)
      expect(key.startsWith("continue_") || key === "settle_now", key).toBe(true);
    expect(CONTINUE_OPTIONS.size).toBe(10);
  });
});
