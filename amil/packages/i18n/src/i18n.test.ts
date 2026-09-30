import { describe, expect, it } from "vitest";
import {
  arabicTerm,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  messages,
  normaliseDigits,
  toArabicIndicDigits,
} from "./index";

const en = { locale: "en" } as const;
const arLatn = { locale: "ar", digitStyle: "latn" } as const;
const arArab = { locale: "ar", digitStyle: "arab" } as const;

describe("digits", () => {
  it("converts ASCII digits to Arabic-Indic", () => {
    expect(toArabicIndicDigits("42000")).toBe("٤٢٠٠٠");
  });

  it.each([
    ["٤٢٬٠٠٠٫٥٠", "42,000.50"],
    ["٣٦٪", "36%"],
    ["۴۲۰", "420"], // extended (Persian) forms
    ["QAR 420.00", "QAR 420.00"],
    ["مبلغ ٤٢٠ ريال", "مبلغ 420 ريال"],
  ])("normaliseDigits(%j) = %j", (input, expected) => {
    expect(normaliseDigits(input)).toBe(expected);
  });

  it("round-trips formatted Arabic money back to ASCII", () => {
    expect(normaliseDigits(formatNumber("42000.00", arArab))).toBe("42,000.00");
  });
});

describe("formatting", () => {
  it.each([
    ["420.00", en, "QAR 420.00"],
    ["42000.00", en, "QAR 42,000.00"],
    ["1234567.89", en, "QAR 1,234,567.89"],
    ["420.00", arLatn, "420.00 ر.ق"],
    ["42000.00", arArab, "٤٢٬٠٠٠٫٠٠ ر.ق"],
    ["-15.50", en, "QAR -15.50"],
  ] as const)("formatMoney(%s)", (value, opts, expected) => {
    expect(formatMoney(value, opts)).toBe(expected);
  });

  it.each([
    ["36.0000", en, "36%"],
    ["5.5000", en, "5.5%"],
    ["2.75", arArab, "٢٫٧٥٪"],
    ["100", arLatn, "100%"],
  ] as const)("formatPercent(%s)", (value, opts, expected) => {
    expect(formatPercent(value, opts)).toBe(expected);
  });

  it.each([
    ["2026-11-14", en, "14 Nov 2026"],
    ["2026-11-14T00:00:00.000Z", arLatn, "14 نوفمبر 2026"],
    ["2026-01-05", arArab, "٥ يناير ٢٠٢٦"],
  ] as const)("formatDate(%s)", (value, opts, expected) => {
    expect(formatDate(value, opts)).toBe(expected);
  });

  it("rejects non-decimal input rather than guessing", () => {
    expect(() => formatNumber("4.2e4", en)).toThrow(TypeError);
    expect(() => formatDate("14/11/2026", en)).toThrow(TypeError);
  });
});

describe("glossary", () => {
  it.each([
    ["points", "نقاط"],
    ["early settlement", "السداد المبكر"],
    ["profit rate", "معدل الربح"],
    ["takaful", "التكافل"],
    ["ibra", "الإبراء"],
  ] as const)("%s -> %s", (term, expected) => {
    expect(arabicTerm(term)).toBe(expected);
  });
});

describe("messages", () => {
  it("has the same keys in en and ar", () => {
    const keys = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null ? keys(v as object, `${p}${k}.`) : [`${p}${k}`],
      );
    expect(keys(messages.ar).sort()).toEqual(keys(messages.en).sort());
  });

  it("carries the demo disclaimer", () => {
    expect(messages.en.demo.footer).toBe("Demo data — Doha Demo Bank is fictional");
  });
});
