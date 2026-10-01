import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWLEDGE, normaliseQuery, searchKnowledge } from "./knowledge";
import { copyViolations } from "./templates";

const dir = join(import.meta.dirname, "..", "knowledge");

describe("knowledge base (bank-approved FAQ)", () => {
  it("the generated module matches knowledge/*.md (run `pnpm gen:knowledge`)", () => {
    const fromDisk = (["en", "ar"] as const).flatMap((locale) =>
      readdirSync(join(dir, locale))
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((f) => {
          const raw = readFileSync(join(dir, locale, f), "utf8");
          return {
            id: /\nid: (.+)\n/.exec(raw)?.[1],
            locale,
            body: raw.split("\n---\n")[1]?.trim(),
          };
        }),
    );
    expect(
      KNOWLEDGE.map((e) => ({ id: e.id, locale: e.locale, body: e.paragraphs.join("\n\n") })),
    ).toEqual(fromDisk);
  });

  it("every topic exists in English and Arabic", () => {
    const en = KNOWLEDGE.filter((e) => e.locale === "en").map((e) => e.id);
    const ar = KNOWLEDGE.filter((e) => e.locale === "ar").map((e) => e.id);
    expect(ar).toEqual(en);
    expect(en.length).toBeGreaterThanOrEqual(10);
  });

  it.each(KNOWLEDGE.map((e) => [`${e.locale}/${e.id}`, e] as const))(
    "%s has no figures and follows the copy policy for both variants",
    (_name, e) => {
      for (const text of [e.title, ...e.paragraphs]) {
        // Figures only ever come from the engine; FAQ copy states rules, not numbers.
        expect(text).not.toMatch(/[0-9٠-٩]/);
        expect(copyViolations(text, e.locale, "islamic")).toEqual([]);
      }
    },
  );
});

describe("searchKnowledge", () => {
  it.each([
    ["en", "what does dormant mean for my account", "dormancy"],
    ["en", "Is there an annual fee refund?", "annual-fee-refund"],
    ["en", "explain ibra please", "ibra"],
    ["en", "what data does AMIL use about me", "amil-data"],
    ["ar", "ما هو الإبراء؟", "ibra"],
    ["ar", "متى تنتهي صلاحية النقاط", "reward-points"],
    ["ar", "ماذا يعني الخمول", "dormancy"],
  ] as const)("%s: %j -> %s", (locale, q, id) => {
    expect(searchKnowledge(q, locale)?.id).toBe(id);
  });

  it("returns null when nothing matches", () => {
    expect(searchKnowledge("tell me a joke", "en")).toBeNull();
  });

  it("normalises Arabic letter variants and diacritics", () => {
    expect(normaliseQuery("الإبْراء؟")).toBe("الابراء");
  });
});
