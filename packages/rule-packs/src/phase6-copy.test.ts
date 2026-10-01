import { formatDate, formatMoney, formatNumber, formatPercent, type Locale } from "@amil/i18n";
import type { Fact } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import {
  compareDepositBreakVsWait,
  compareMinVsCustomPayment,
  compareSettlementTiming,
  COMPARE_SCENARIOS,
  type Comparison,
} from "./compare/compare";
import { aishaDeposit, fatimaFinance, minimumPayment, NOW, smallLoan } from "./fixtures";
import { PACKS } from "./registry";
import { renderTemplate, stripTemplateSyntax, templateFactKeys } from "./template";
import {
  ASSISTANT_TEMPLATES,
  COMPARE_TEMPLATES,
  copyPolicy,
  copyViolations,
  factLabel,
  optionTitle,
  suggestion,
} from "./templates";

const LOCALES: Locale[] = ["en", "ar"];
const VARIANTS = ["conventional", "islamic"] as const;
const formatter = (locale: Locale) => (f: Fact) => {
  const opts = { locale, digitStyle: "latn" as const };
  if (f.unit === "QAR") return formatMoney(f.value, opts);
  if (f.unit === "percent") return formatPercent(f.value, opts);
  if (f.unit === "date") return formatDate(f.value, opts);
  return f.unit === "boolean" || f.unit === "code" ? f.value : formatNumber(f.value, opts);
};

const comparisons: [string, Comparison][] = [
  [
    "fatima",
    compareSettlementTiming(
      fatimaFinance(),
      PACKS["finance.early_settlement"].islamic.defaultParameters,
      NOW,
    ),
  ],
  [
    "small loan (today cheapest)",
    compareSettlementTiming(
      smallLoan(),
      PACKS["finance.early_settlement"].conventional.defaultParameters,
      new Date("2026-02-25T10:00:00Z"),
    ),
  ],
  [
    "minimum",
    compareMinVsCustomPayment(
      minimumPayment(),
      PACKS["card.minimum_payment"].conventional.defaultParameters,
    ),
  ],
  [
    "aisha",
    compareDepositBreakVsWait(
      aishaDeposit(),
      PACKS["deposit.break"].conventional.defaultParameters,
      NOW,
    ),
  ],
];

describe("compare copy", () => {
  it.each(
    COMPARE_SCENARIOS.flatMap((s) =>
      VARIANTS.flatMap((v) => LOCALES.map((l) => [s, v, l] as const)),
    ),
  )("%s / %s / %s has exactly one approved summary", (s, v, l) => {
    expect(
      COMPARE_TEMPLATES.filter(
        (t) => t.rulePackKey === `compare.${s}` && t.variant === v && t.locale === l,
      ),
    ).toHaveLength(1);
  });

  it.each(
    comparisons.flatMap(([n, c]) =>
      VARIANTS.flatMap((v) => LOCALES.map((l) => [n, v, l, c] as const)),
    ),
  )("%s renders (%s, %s) with labelled facts and titled options", (_n, variant, locale, c) => {
    const t = COMPARE_TEMPLATES.find(
      (x) =>
        x.rulePackKey === `compare.${c.scenario}` && x.variant === variant && x.locale === locale,
    );
    if (!t) throw new Error("missing");
    const headline = renderTemplate(t.headline, c.summary, formatter(locale));
    const body = renderTemplate(t.body, c.summary, formatter(locale));
    expect([...headline.missing, ...body.missing]).toEqual([]);
    expect(headline.text.length).toBeLessThanOrEqual(copyPolicy.maxHeadlineChars);
    expect(copyViolations(`${headline.text} ${body.text}`, locale, variant)).toEqual([]);
    for (const o of c.options) {
      expect(optionTitle(locale, o.key)).not.toBe(o.key);
      for (const k of Object.keys(o.facts).filter((x) => x !== "_sources"))
        expect(factLabel(`compare.${c.scenario}`, locale, k), k).not.toBe(k);
      if (o.action) expect(t.options.map((x) => x.key)).toContain(o.action);
    }
  });
});

describe("assistant phrases", () => {
  const keys = [...new Set(ASSISTANT_TEMPLATES.map((t) => t.rulePackKey))];

  it("cover help, refusals, consent, clarification and the answer kinds", () => {
    expect(keys.sort()).toEqual(
      [
        "assistant.ask_amount",
        "assistant.charge",
        "assistant.clarify",
        "assistant.faq",
        "assistant.help",
        "assistant.no_charges",
        "assistant.no_consent",
        "assistant.no_product",
        "assistant.nothing",
        "assistant.products",
        "assistant.refuse_advice",
        "assistant.refuse_scope",
        "assistant.unavailable",
        "assistant.unknown",
      ].sort(),
    );
  });

  it.each(keys.flatMap((k) => VARIANTS.flatMap((v) => LOCALES.map((l) => [k, v, l] as const))))(
    "%s / %s / %s exists, is variant-neutral and has only labelled placeholders",
    (key, variant, locale) => {
      const matches = ASSISTANT_TEMPLATES.filter(
        (t) => t.rulePackKey === key && t.variant === variant && t.locale === locale,
      );
      expect(matches).toHaveLength(1);
      const t = matches[0];
      if (!t) return;
      for (const text of [t.headline, t.body, ...t.options.map((o) => o.label)]) {
        expect(copyViolations(stripTemplateSyntax(text), locale, "islamic")).toEqual([]);
        expect(stripTemplateSyntax(text)).not.toMatch(/[0-9٠-٩]/);
        const { sections, placeholders } = templateFactKeys(text);
        for (const k of [...sections, ...placeholders])
          expect(factLabel("assistant", locale, k), k).not.toBe(k);
      }
      expect(t.options.at(-1)?.key).toBe("talk_to_someone");
    },
  );

  it("suggested questions exist in both languages for the same topics", () => {
    for (const topic of [
      "card.close",
      "finance.early_settlement",
      "deposit.break",
      "explain.charge",
      "products",
    ]) {
      expect(suggestion("en", topic)).toBeTruthy();
      expect(suggestion("ar", topic)).toBeTruthy();
    }
    expect(suggestion("en", "nope")).toBeUndefined();
  });
});
