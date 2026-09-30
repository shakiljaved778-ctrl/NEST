import {
  ARABIC_DECIMAL_SEPARATOR,
  ARABIC_PERCENT_SIGN,
  ARABIC_THOUSANDS_SEPARATOR,
  toArabicIndicDigits,
  type DigitStyle,
} from "./digits";

/**
 * Deterministic en/ar formatting. We deliberately do not use Intl here: its output varies with
 * the ICU version, and the number validator must be able to parse back exactly what we render.
 * Inputs are plain decimal strings produced by the rules engine, so there are no floats.
 */

export type Locale = "en" | "ar";
export const LOCALES: readonly Locale[] = ["en", "ar"] as const;

export interface FormatOptions {
  locale: Locale;
  /** Only affects Arabic; English always uses ASCII digits. */
  digitStyle?: DigitStyle;
}

const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

function useArabicDigits(opts: FormatOptions): boolean {
  return opts.locale === "ar" && opts.digitStyle === "arab";
}

function localiseDigits(ascii: string, opts: FormatOptions): string {
  if (!useArabicDigits(opts)) return ascii;
  return toArabicIndicDigits(
    ascii.replace(/[.,]/g, (c) =>
      c === "." ? ARABIC_DECIMAL_SEPARATOR : ARABIC_THOUSANDS_SEPARATOR,
    ),
  );
}

/** "42000.5" -> "42,000.5" (grouping only; no rounding, the engine already rounded). */
function groupAscii(value: string): string {
  const m = DECIMAL_RE.exec(value.trim());
  if (!m) throw new TypeError(`formatNumber expects a plain decimal string, got "${value}"`);
  const [, sign = "", int = "0", frac] = m;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${frac !== undefined ? `.${frac}` : ""}`;
}

/** Group and localise a decimal string: formatNumber("42000", {locale:"ar", digitStyle:"arab"}) = "٤٢٬٠٠٠". */
export function formatNumber(value: string, opts: FormatOptions): string {
  return localiseDigits(groupAscii(value), opts);
}

export const CURRENCY_LABEL: Record<Locale, string> = { en: "QAR", ar: "ر.ق" };

/** "420.00" -> en "QAR 420.00", ar "420.00 ر.ق" (or "٤٢٠٫٠٠ ر.ق"). Value must already have 2 dp. */
export function formatMoney(value: string, opts: FormatOptions): string {
  const n = formatNumber(value, opts);
  return opts.locale === "en" ? `QAR ${n}` : `${n} ${CURRENCY_LABEL.ar}`;
}

/** Percent from an annual-percent string with trailing zeros trimmed: "36.0000" -> "36%", "5.5000" -> "5.5%". */
export function formatPercent(value: string, opts: FormatOptions): string {
  const trimmed = value.includes(".") ? value.replace(/\.?0+$/, "") : value;
  const n = formatNumber(trimmed, opts);
  return useArabicDigits(opts) ? `${n}${ARABIC_PERCENT_SIGN}` : `${n}%`;
}

const MONTHS: Record<Locale, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: [
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
  ],
};

/** "2026-11-14" (or a full ISO timestamp, UTC) -> en "14 Nov 2026", ar "14 نوفمبر 2026". */
export function formatDate(iso: string, opts: FormatOptions): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new TypeError(`formatDate expects an ISO date, got "${iso}"`);
  const [, y = "", mo = "", d = ""] = m;
  const month = MONTHS[opts.locale][Number(mo) - 1];
  if (!month) throw new RangeError(`Invalid month in "${iso}"`);
  return `${localiseDigits(String(Number(d)), opts)} ${month} ${localiseDigits(y, opts)}`;
}

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}
