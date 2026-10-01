import { ASSISTANT_TEMPLATES, COMPARE_TEMPLATES, KNOWLEDGE } from "@amil/rule-packs";
import {
  cardClosePacks,
  financeEarlySettlementPacks,
  renderTemplate,
  TEMPLATES,
} from "@amil/rule-packs";
import {
  fatimaFinance,
  financeThresholds,
  khalidCard,
  NOW,
  thresholds,
} from "@amil/rule-packs/fixtures";
import type { AnyFactSet } from "@amil/rules-engine";
import { describe, expect, it } from "vitest";
import { formatFact } from "./format";
import { validateNumbers } from "./validator";

const khalid = cardClosePacks.conventional.evaluate(
  khalidCard(),
  cardClosePacks.conventional.defaultParameters,
  thresholds,
  NOW,
);
const fatima = financeEarlySettlementPacks.islamic.evaluate(
  fatimaFinance(),
  financeEarlySettlementPacks.islamic.defaultParameters,
  financeThresholds,
  NOW,
);
const K: AnyFactSet = khalid.facts;
const F: AnyFactSet = fatima.facts;

describe("number validator: accepts figures that are in the fact set", () => {
  it.each([
    ["Closing this card forfeits 42,000 points (about QAR 420.00).", K],
    ["Closing this card forfeits 42000 points worth QAR 420.", K], // grouping and trailing zeros don't matter
    ["8,000 points expire on 14 Nov 2026.", K],
    ["8,000 points expire on 14 November 2026.", K],
    ["8,000 points expire on November 14, 2026.", K],
    ["8,000 points expire on 2026-11-14.", K],
    ["8,000 points expire on 14/11/2026.", K],
    ["8,000 points expire on 14 Nov.", K], // day + month of a date fact
    ["تنتهي ٤٢٬٠٠٠ نقطة، قيمتها نحو ٤٢٠٫٠٠ ر.ق.", K], // Arabic-Indic digits and separators
    ["السداد في ١٩ أكتوبر ٢٠٢٦ يوفّر ٤٬٠٠٠٫٠٠ ر.ق", F],
    ["Settling on 19 Oct 2026 lowers your outflow by QAR 4,000.00; today's ibra is 50%.", F],
  ] as const)("%j", (text, facts) => {
    expect(validateNumbers(text, facts)).toEqual({ ok: true, offending: [] });
  });

  it("accepts every approved template rendered against its own facts (en and ar)", () => {
    for (const [ev, pack, variant] of [
      [khalid, "card.close", "conventional"],
      [fatima, "finance.early_settlement", "islamic"],
    ] as const) {
      for (const locale of ["en", "ar"] as const) {
        for (const digitStyle of ["latn", "arab"] as const) {
          const t = TEMPLATES.find(
            (x) =>
              x.rulePackKey === pack &&
              x.variant === variant &&
              x.locale === locale &&
              x.severity === ev.severity,
          );
          if (!t) throw new Error("template");
          const fmt = (f: Parameters<typeof formatFact>[0]) =>
            formatFact(f, { locale, digitStyle });
          const text = `${renderTemplate(t.headline, ev.facts, fmt).text} ${renderTemplate(t.body, ev.facts, fmt).text}`;
          expect(validateNumbers(text, ev.facts), `${pack}/${locale}/${digitStyle}`).toEqual({
            ok: true,
            offending: [],
          });
        }
      }
    }
  });
});

describe("number validator: rejects injected or altered figures (adversarial)", () => {
  it.each([
    [
      "changed amount",
      "Closing this card forfeits 42,000 points (about QAR 421.00).",
      K,
      ["421.00"],
    ],
    ["rounded amount", "You lose about QAR 500.", K, ["500"]],
    ["computed total", "Points and fees together cost QAR 492.50.", K, ["492.50"]],
    ["invented percentage", "That is 10% of your balance.", K, ["10"]],
    ["future tier presented as a fact", "With an ibra of 75%.", F, ["75"]], // only today's 50% is a fact
    ["negative sign", "Your balance changes by -420.00.", K, ["-420.00"]],
    ["European grouping", "You lose 42.000 points.", K, ["42.000"]],
    ["Arabic-Indic altered amount", "قيمتها نحو ٤٢١٫٠٠ ر.ق", K, ["421.00"]],
    ["extended Arabic-Indic digits", "قيمتها ۴۲۱ ر.ق", K, ["421"]],
    ["full-width digits", "worth ４２１ QAR", K, ["421"]],
    ["zero-width split digits", "worth 4\u200B21 QAR", K, ["421"]],
    ["bidi-control split digits", "worth 42\u200F1 QAR", K, ["421"]],
    ["wrong date", "Settle on 20 October 2026.", F, ["20 October 2026"]],
    ["wrong ISO date", "Settle on 2026-10-20.", F, ["2026-10-20"]],
    ["wrong Arabic date", "السداد في ٢٠ أكتوبر ٢٠٢٦", F, ["20 أكتوبر 2026"]],
    ["wrong d/m/y date", "Settle on 20/10/2026.", F, ["20/10/2026"]],
    ["ordinal instalment number", "After your 12th instalment.", F, ["12"]],
    ["bare year", "Before the end of 2026.", F, ["2026"]],
    ["spelled-out number (en)", "You save four thousand riyals.", F, ["four", "thousand"]],
    ["spelled-out number (ar)", "توفّر أربعة آلاف ريال", F, ["أربعة", "آلاف"]],
    ["spelled-out number with prefix (ar)", "وثلاثة أقساط", F, ["وثلاثة"]],
    ["spelled-out number with diacritics (ar)", "ستّة أشهر", F, ["ستة"]],
  ] as const)("%s", (_name, text, facts, offending) => {
    expect(validateNumbers(text, facts)).toEqual({ ok: false, offending });
  });

  it("Arabic words that merely start with a number word are not numbers", () => {
    // ستُعاد "will be returned", ستتوقف "will stop": the future prefix سـ + تـ, not ست (six)
    expect(validateNumbers("الشيكات ستُعاد دون صرف وستتوقف الأوامر", K).ok).toBe(true);
  });

  it("a text with no figures at all is fine", () => {
    expect(validateNumbers("Before you close this card, here is what changes.", K).ok).toBe(true);
  });
});

describe("approved Ask AMIL, compare and FAQ copy never trips the validator by itself", () => {
  const all = [
    ...ASSISTANT_TEMPLATES.flatMap((t) =>
      [t.headline, t.body].map((x) => [`${t.key}/${t.locale}`, x] as const),
    ),
    ...COMPARE_TEMPLATES.flatMap((t) =>
      [t.headline, t.body].map((x) => [`${t.key}/${t.locale}`, x] as const),
    ),
    ...KNOWLEDGE.flatMap((e) =>
      [e.title, ...e.paragraphs].map((x) => [`faq/${e.locale}/${e.id}`, x] as const),
    ),
  ];
  it.each(all)("%s", (_name, text) => {
    // Placeholders are filled from facts; the literal copy around them must contain no numbers,
    // including spelled-out ones ("one", "ست").
    const literal = text
      .replace(/\{\w+\}/g, " ")
      .replace(/\[\[!?\w+:/g, " ")
      .replace(/\]\]/g, " ");
    expect(validateNumbers(literal, { _sources: [] })).toEqual({ ok: true, offending: [] });
  });
});
