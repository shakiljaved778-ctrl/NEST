import { KNOWLEDGE } from "./knowledge.generated";

/** One bank-approved FAQ entry (knowledge/{locale}/{id}.md). */
export interface KnowledgeEntry {
  id: string;
  locale: "en" | "ar";
  title: string;
  keywords: string[];
  paragraphs: string[];
}

export { KNOWLEDGE };

/** Normalise for matching: lower case, Arabic letter variants folded, diacritics and punctuation dropped. */
export function normaliseQuery(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Matching form: normalised, with the Arabic definite article (and a leading و/ب/ل before it) dropped. */
function matchForm(text: string): string {
  return normaliseQuery(text)
    .split(" ")
    .map((w) => w.replace(/^[وبلف]?ال(?=\p{L}{2})/u, ""))
    .join(" ");
}

/**
 * searchProductRules: the best-matching approved FAQ entry for a question, or null. Scores whole
 * keyword phrases found in the question (weighted by length), so "close card" beats "card".
 * Deterministic and local: the question is never sent anywhere.
 */
export function searchKnowledge(question: string, locale: "en" | "ar"): KnowledgeEntry | null {
  const q = ` ${matchForm(question)} `;
  let best: { entry: KnowledgeEntry; score: number } | null = null;
  for (const entry of KNOWLEDGE) {
    if (entry.locale !== locale) continue;
    let score = 0;
    for (const k of entry.keywords) {
      const key = matchForm(k);
      if (key && q.includes(` ${key} `)) score += key.split(" ").length;
    }
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
}
