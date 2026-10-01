import type { Fact } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import {
  isTruthyFact,
  renderedFactKeys,
  renderTemplate,
  stripTemplateSyntax,
  templateFactKeys,
} from "./template";

const fact = (key: string, value: string, unit: Fact["unit"]): Fact => ({
  key,
  value,
  unit,
  source: "computed",
  asOf: "2026-09-30",
});
const facts = {
  points: fact("points", "42000", "points"),
  value: fact("value", "420.00", "QAR"),
  zero: fact("zero", "0.00", "QAR"),
  yes: fact("yes", "true", "boolean"),
  no: fact("no", "false", "boolean"),
  date: fact("date", "2026-11-14", "date"),
  empty: fact("empty", "", "date"),
};
const fmt = (f: Fact) => (f.unit === "QAR" ? `QAR ${f.value}` : f.value);

describe("renderTemplate", () => {
  it.each([
    ["{points} points (about {value})", "42000 points (about QAR 420.00)"],
    ["[[points: shown {points}.]] [[zero: hidden.]]", "shown 42000."],
    ["[[!zero: zero is zero.]][[!points: hidden]]", "zero is zero."],
    ["[[yes: yes.]][[no: no.]][[date: on {date}.]][[empty: never]]", "yes.on 2026-11-14."],
    ["[[unknown: hidden when the fact is missing]]done", "done"],
    ["[[!unknown: shown when the fact is missing]]", "shown when the fact is missing"],
  ])("%j -> %j", (template, expected) => {
    expect(renderTemplate(template, facts, fmt)).toEqual({ text: expected, missing: [] });
  });

  it("reports missing placeholders instead of inventing a value", () => {
    expect(renderTemplate("You save {saving}.", facts, fmt)).toEqual({
      text: "You save {saving}.",
      missing: ["saving"],
    });
  });

  it("never treats _sources as a fact", () => {
    expect(renderTemplate("{_sources}", { ...facts, _sources: [] }, fmt).missing).toEqual([
      "_sources",
    ]);
  });
});

describe("templateFactKeys", () => {
  it("lists section conditions and placeholders", () => {
    expect(templateFactKeys("[[a: {b}]] [[!c: x]] {d}")).toEqual({
      sections: ["a", "c"],
      placeholders: ["b", "d"],
    });
  });
});

describe("isTruthyFact", () => {
  it.each([
    [facts.points, true],
    [facts.zero, false],
    [facts.yes, true],
    [facts.no, false],
    [facts.date, true],
    [facts.empty, false],
    [undefined, false],
  ])("%j -> %s", (f, expected) => {
    expect(isTruthyFact(f)).toBe(expected);
  });
});

describe("stripTemplateSyntax", () => {
  it("keeps visible copy and placeholders, drops markers", () => {
    expect(stripTemplateSyntax("[[a: one {b}.]][[!c: two]]").replace(/\s+/g, " ").trim()).toBe(
      "one {b}. two",
    );
  });
});

describe("renderedFactKeys", () => {
  it("lists only placeholders that are visible after sections are applied", () => {
    expect(
      renderedFactKeys("{points} [[zero: {value}]] [[!zero: {date}]] [[!points: {empty}]]", facts),
    ).toEqual(["points", "date"]);
  });
});
