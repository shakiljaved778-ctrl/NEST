import { type AnyFactSet, D, type Fact, type FactSource } from "@amil/rules-engine";

/**
 * Tiny, auditable template language for bank-approved copy:
 *
 *   {factKey}               replaced by the formatted fact value
 *   [[factKey: some text]]  section rendered only when the fact is present and "truthy"
 *                           (a number > 0, boolean "true", or a non-empty date/code)
 *   [[!factKey: some text]] section rendered only when the fact is absent or not truthy
 *
 * Sections keep zero amounts and irrelevant sentences out of the copy without the wording ever
 * being generated (non-negotiable 1). Sections do not nest.
 */

const SECTION_RE = /\[\[(!?)(\w+):\s?([^\]]*)\]\]/g;
const PLACEHOLDER_RE = /\{(\w+)\}/g;

export type FactFormatter = (fact: Fact) => string;

export function isTruthyFact(fact: Fact | undefined): boolean {
  if (!fact) return false;
  switch (fact.unit) {
    case "boolean":
      return fact.value === "true";
    case "date":
    case "code":
      return fact.value.length > 0;
    default:
      return D(fact.value).greaterThan(0);
  }
}

/** All fact keys a template references: as section conditions and as placeholders. */
export function templateFactKeys(text: string): { sections: string[]; placeholders: string[] } {
  const sections = [...text.matchAll(SECTION_RE)].map((m) => String(m[2]));
  const placeholders = [...text.matchAll(PLACEHOLDER_RE)].map((m) => String(m[1]));
  return { sections, placeholders };
}

export interface RenderResult {
  text: string;
  /** Placeholders with no matching fact. Non-empty means the copy must not be served. */
  missing: string[];
}

export function renderTemplate(
  text: string,
  facts: AnyFactSet | Readonly<Record<string, Fact>>,
  format: FactFormatter,
): RenderResult {
  const lookup = (key: string): Fact | undefined => {
    if (key === "_sources") return undefined;
    const value = (facts as Readonly<Record<string, Fact | FactSource[] | undefined>>)[key];
    return value === undefined || Array.isArray(value) ? undefined : value;
  };
  const missing: string[] = [];
  const withSections = text.replace(SECTION_RE, (_m, negate: string, key: string, body: string) =>
    isTruthyFact(lookup(key)) !== (negate === "!") ? body : "",
  );
  const rendered = withSections.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const fact = lookup(key);
    if (!fact) {
      missing.push(key);
      return `{${key}}`;
    }
    return format(fact);
  });
  return { text: rendered.replace(/\s{2,}/g, " ").trim(), missing };
}

/** The template's visible copy with section markers removed (placeholders kept), for linting. */
export function stripTemplateSyntax(text: string): string {
  return text.replace(SECTION_RE, (_m, _negate: string, _key: string, body: string) => ` ${body} `);
}
