import { describe, expect, it } from "vitest";
import { PACKS, type PackKey, VALUE_AT_STAKE_FACT } from "./registry";

describe("VALUE_AT_STAKE_FACT", () => {
  it.each(Object.keys(PACKS) as PackKey[])(
    "%s names a declared QAR fact in both variants",
    (key) => {
      const fact = VALUE_AT_STAKE_FACT[key];
      if (fact === null) return;
      for (const variant of ["conventional", "islamic"] as const) {
        const declared = PACKS[key][variant].definition.facts.find((f) => f.key === fact);
        expect(declared?.unit).toBe("QAR");
      }
    },
  );

  it("only account.dormancy (time-based) has no value at stake", () => {
    expect(Object.entries(VALUE_AT_STAKE_FACT).filter(([, v]) => v === null)).toEqual([
      ["account.dormancy", null],
    ]);
  });
});
