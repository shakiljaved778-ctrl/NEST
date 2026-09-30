/**
 * Digit handling. Banks may show Arabic-Indic digits (٠-٩) in Arabic. The number validator
 * normalises everything back to ASCII before comparing figures (non-negotiable 2).
 */

export type DigitStyle = "latn" | "arab";

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0; // ۰ (Persian/Urdu forms)

export const ARABIC_DECIMAL_SEPARATOR = "٫"; // ٫
export const ARABIC_THOUSANDS_SEPARATOR = "٬"; // ٬
export const ARABIC_PERCENT_SIGN = "٪"; // ٪

/** ASCII digits -> Arabic-Indic digits. Other characters are untouched. */
export function toArabicIndicDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => String.fromCharCode(ARABIC_INDIC_ZERO + Number(d)));
}

/**
 * Normalise any Arabic-Indic / extended Arabic-Indic digits and Arabic numeric punctuation to
 * ASCII: "٤٢٬٠٠٠٫٥٠" -> "42,000.50", "٣٦٪" -> "36%".
 */
export function normaliseDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    } else if (ch === ARABIC_DECIMAL_SEPARATOR) {
      out += ".";
    } else if (ch === ARABIC_THOUSANDS_SEPARATOR) {
      out += ",";
    } else if (ch === ARABIC_PERCENT_SIGN) {
      out += "%";
    } else {
      out += ch;
    }
  }
  return out;
}
