import { normaliseDigits } from "@amil/i18n";
import { type AnyFactSet, D, type Dec, type Fact } from "@amil/rules-engine";

/**
 * Number validator (non-negotiable 2). Model wording may only contain numbers, amounts,
 * percentages and dates that exist in the fact set. Anything else is rejected, and the caller
 * falls back to the approved static template.
 *
 * Normalisation first, so tricks cannot hide a number:
 *   - Unicode NFKC (full-width digits ０-９ become 0-9), Arabic-Indic ٠-٩ and ۰-۹ digits,
 *     Arabic decimal/thousands/percent signs;
 *   - zero-width and bidi control characters are removed ("4\u200B21" is 421).
 * Then:
 *   1. Dates (ISO, d/m/y, "19 Oct 2026", "October 19, 2026", "19 أكتوبر 2026", "19 Oct")
 *      must match a date fact.
 *   2. Every remaining number must equal (numerically) a numeric fact ("4,000" = 4000.00).
 *   3. Numbers written as words (en/ar) are rejected outright.
 */

export interface ValidationResult {
  ok: boolean;
  offending: string[];
}

const INVISIBLES = /[\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

const EN_MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const EN_MONTH_RE =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";
const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const AR_MONTH_RE = `(${AR_MONTHS.join("|")})`;

const EN_NUMBER_WORDS = new Set(
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred hundreds thousand thousands million millions billion dozen dozens half quarter double twice triple".split(
    " ",
  ),
);
const AR_NUMBER_WORDS = new Set(
  "صفر واحد واحدة اثنان اثنين اثنتان اثنتين ثلاث ثلاثة أربع أربعة خمس خمسة ست ستة سبع سبعة ثمان ثماني ثمانية تسع تسعة عشر عشرة عشرون عشرين ثلاثون ثلاثين أربعون أربعين خمسون خمسين ستون ستين سبعون سبعين ثمانون ثمانين تسعون تسعين مئة مائة مئتان مئتين مائتان مائتين مئات ألف ألفان ألفين آلاف مليون ملايين مليار نصف ربع ضعف".split(
    " ",
  ),
);
const AR_PREFIXES = ["وب", "ول", "وال", "بال", "لل", "ال", "و", "ب", "ل", "ف"];

/** Normalise text so that every way of writing a digit becomes ASCII. */
export function normaliseForValidation(text: string): string {
  return normaliseDigits(text.normalize("NFKC").replace(INVISIBLES, ""));
}

function monthIndexEn(name: string): number {
  return EN_MONTHS.indexOf(name.slice(0, 3).toLowerCase());
}

const pad = (n: number) => String(n).padStart(2, "0");

function isNumericUnit(fact: Fact): boolean {
  return fact.unit !== "date" && fact.unit !== "code" && fact.unit !== "boolean";
}

export function validateNumbers(text: string, facts: AnyFactSet): ValidationResult {
  const offending: string[] = [];
  const all = Object.entries(facts)
    .filter(([k, f]) => k !== "_sources" && !Array.isArray(f))
    .map(([, f]) => f as Fact);
  const dates = new Set(all.filter((f) => f.unit === "date" && f.value).map((f) => f.value));
  const dayMonths = new Set([...dates].map((d) => d.slice(5)));
  const numbers: Dec[] = all.filter(isNumericUnit).map((f) => D(f.value));

  let rest = normaliseForValidation(text);

  const checkDate = (raw: string, y: number | null, m: number, d: number): string => {
    const iso = y === null ? null : `${y}-${pad(m)}-${pad(d)}`;
    const ok = iso === null ? dayMonths.has(`${pad(m)}-${pad(d)}`) : dates.has(iso);
    if (!ok) offending.push(raw.trim());
    return " ";
  };

  // 1. Dates. Each matched date is removed from the text so its parts are not re-checked as numbers.
  rest = rest.replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (m, y: string, mo: string, d: string) =>
    checkDate(m, Number(y), Number(mo), Number(d)),
  );
  rest = rest.replace(
    /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g,
    (m, d: string, mo: string, y: string) => checkDate(m, Number(y), Number(mo), Number(d)),
  );
  rest = rest.replace(
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${EN_MONTH_RE}\\b,?(?:\\s+(\\d{4}))?`,
      "gi",
    ),
    (m, d: string, mon: string, y?: string) =>
      checkDate(m, y ? Number(y) : null, monthIndexEn(mon) + 1, Number(d)),
  );
  rest = rest.replace(
    new RegExp(`\\b${EN_MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b,?(?:\\s+(\\d{4}))?`, "gi"),
    (m, mon: string, d: string, y?: string) =>
      checkDate(m, y ? Number(y) : null, monthIndexEn(mon) + 1, Number(d)),
  );
  rest = rest.replace(
    new RegExp(`(\\d{1,2})\\s+${AR_MONTH_RE}(?:\\s+(\\d{4}))?`, "g"),
    (m, d: string, mon: string, y?: string) =>
      checkDate(m, y ? Number(y) : null, AR_MONTHS.indexOf(mon) + 1, Number(d)),
  );

  // 2. Numbers: grouped ("4,000.00") or plain ("4000", "75.5"), optionally signed.
  rest.replace(/[-−]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-−]?\d+(?:\.\d+)?/g, (raw) => {
    const value = D(raw.replace(/,/g, "").replace("−", "-"));
    if (!numbers.some((n) => n.equals(value))) offending.push(raw);
    return " ";
  });

  // 3. Numbers spelled out.
  for (const token of rest
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean)) {
    if (EN_NUMBER_WORDS.has(token)) {
      offending.push(token);
      continue;
    }
    const stems = [
      token,
      ...AR_PREFIXES.filter((p) => token.startsWith(p)).map((p) => token.slice(p.length)),
    ];
    if (stems.some((s) => AR_NUMBER_WORDS.has(s))) offending.push(token);
  }

  return { ok: offending.length === 0, offending };
}
