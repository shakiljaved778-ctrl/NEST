import { copyViolations } from "@amil/rule-packs";
import type { Locale } from "@amil/i18n";
import type { AnyFactSet, Variant } from "@amil/rules-engine";
import { z } from "zod";
import { validateNumbers } from "./validator";

/** The only shape model wording may take (section 8). */
export const WordingSchema = z.object({
  headline: z.string().trim().min(1).max(90),
  body: z.string().trim().min(1).max(280),
});
export type Wording = z.infer<typeof WordingSchema>;

export interface OutputCheck {
  ok: boolean;
  wording?: Wording;
  reasons: string[];
}

/** Extract a JSON object from model text (tolerates a ```json fence around it). */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

/**
 * Accept model output only if it parses, fits the schema, contains no number/date absent from
 * the facts, and passes the same copy policy as the bank's own templates (no selling, Sharia
 * terminology, no exclamation marks or emojis).
 */
export function checkModelOutput(
  text: string,
  facts: AnyFactSet,
  locale: Locale,
  variant: Variant,
): OutputCheck {
  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch {
    return { ok: false, reasons: ["not_json"] };
  }
  const result = WordingSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reasons: ["schema_mismatch"] };
  const wording = result.data;
  const combined = `${wording.headline}\n${wording.body}`;
  const reasons = [
    ...validateNumbers(combined, facts).offending.map((o) => `number_not_in_facts:${o}`),
    ...copyViolations(combined, locale, variant),
  ];
  return reasons.length === 0 ? { ok: true, wording, reasons } : { ok: false, reasons };
}
