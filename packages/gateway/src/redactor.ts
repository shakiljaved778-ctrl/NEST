import { arabicGlossary, type Locale } from "@amil/i18n";
import type { AnyEvaluation, FactUnit, Severity, Variant } from "@amil/rules-engine";
import { type DisplayOptions, formatFact } from "./format";

/**
 * Builds the ONLY payload a model ever receives (non-negotiable 6). It is constructed from the
 * evaluation's facts and the approved reference wording, never from customer records. As
 * defense in depth:
 *   1. facts whose key looks identity-related are dropped;
 *   2. every value must match the strict shape of its unit, or it is replaced with [REDACTED];
 *   3. the serialized payload is scanned for PII shapes (emails, IBANs, long digit runs,
 *      phone numbers). If anything is found, redaction FAILS CLOSED and the caller uses the
 *      approved template instead.
 */

export const PROMPT_VERSION = "insight.v1";

export interface FactTemplateFact {
  key: string;
  unit: FactUnit;
  display: string;
}

export interface FactTemplate {
  promptVersion: string;
  action: string;
  variant: Variant;
  severity: Severity;
  locale: Locale;
  facts: FactTemplateFact[];
  referenceWording: { headline: string; body: string };
  glossary?: Readonly<Record<string, string>>;
}

export class RedactionError extends Error {
  constructor(readonly findings: string[]) {
    super(`Outbound payload failed the PII scan: ${findings.join(", ")}`);
    this.name = "RedactionError";
  }
}

const IDENTITY_KEY =
  /(^|[^a-z])(id|ref|name|iban|pan|phone|mobile|email|account|number|address|national|passport|card)([^a-z]|$)/i;
const IDENTITY_WORDS =
  /(customer|account|card|iban|pan|phone|mobile|email|name|ref|address|passport|national)(id|ref|number|no|name)?$/i;

/** Keys allowed through: camelCase words that do not name an identity attribute. */
export function isSafeFactKey(key: string): boolean {
  if (!/^[a-z][a-zA-Z]{1,63}$/.test(key)) return false;
  const words = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return !IDENTITY_KEY.test(words) && !IDENTITY_WORDS.test(key);
}

// Retail amounts stay below QAR 1bn, so at most 9 integer digits. Anything longer has the
// shape of an account number or PAN, not an amount, and is redacted.
const VALUE_SHAPES: Record<FactUnit, RegExp> = {
  QAR: /^-?\d{1,9}(\.\d{1,4})?$/,
  points: /^\d{1,9}$/,
  count: /^\d{1,6}$/,
  days: /^-?\d{1,6}$/,
  months: /^\d{1,4}$/,
  percent: /^\d{1,3}(\.\d{1,4})?$/,
  date: /^(\d{4}-\d{2}-\d{2})?$/,
  boolean: /^(true|false)$/,
  code: /^[a-z_]{1,32}$/,
};

export const REDACTED = "[REDACTED]";

const PII_PATTERNS: [string, RegExp][] = [
  // Any local@domain.tld shape: RFC 5322 allows almost any printable local part ("!@a.aa").
  ["email", /[^\s@"<>()[\]]+@[^\s@"<>()[\]]+\.[^\s@"<>()[\]]{2,}/],
  ["iban", /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{6,}/i],
  ["long_digit_run", /\d[\d\s-]{10,}\d/],
  ["phone", /\+\d[\d\s-]{6,}/],
];

/** PII-shaped substrings in an arbitrary string. Exposed for tests and for logging guards. */
export function scanForPii(text: string): string[] {
  return PII_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export interface RedactInput {
  action: string;
  variant: Variant;
  locale: Locale;
  evaluation: AnyEvaluation;
  referenceWording: { headline: string; body: string };
  display: DisplayOptions;
}

export function buildFactTemplate(input: RedactInput): FactTemplate {
  const facts: FactTemplateFact[] = [];
  for (const [key, raw] of Object.entries(input.evaluation.facts)) {
    if (key === "_sources" || Array.isArray(raw)) continue;
    const fact = raw;
    if (!isSafeFactKey(key) || !(fact.unit in VALUE_SHAPES)) continue;
    const valid = VALUE_SHAPES[fact.unit].test(fact.value);
    facts.push({
      key,
      unit: fact.unit,
      display: valid ? formatFact(fact, input.display) : REDACTED,
    });
  }

  const template: FactTemplate = {
    promptVersion: PROMPT_VERSION,
    action: input.action,
    variant: input.variant,
    severity: input.evaluation.severity,
    locale: input.locale,
    facts,
    referenceWording: input.referenceWording,
    ...(input.locale === "ar" ? { glossary: arabicGlossary } : {}),
  };

  const findings = scanForPii(JSON.stringify(template));
  if (findings.length > 0) throw new RedactionError(findings);
  return template;
}
