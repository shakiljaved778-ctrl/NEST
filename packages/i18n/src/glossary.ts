import glossary from "../glossary.ar.json" with { type: "json" };

export type GlossaryTerm = keyof typeof glossary.terms;

export const arabicGlossary: Readonly<Record<string, string>> = glossary.terms;
export const glossaryVersion: string = glossary.version;

/** Bank-approved Arabic rendering for an English domain term. */
export function arabicTerm(term: GlossaryTerm): string {
  return glossary.terms[term];
}
