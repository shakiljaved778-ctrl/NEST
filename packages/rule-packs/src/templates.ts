import type { Severity, Variant } from "@amil/rules-engine";
import { z } from "zod";
import cardCloseTemplates from "../templates/card.close.json" with { type: "json" };
import financeSettlementTemplates from "../templates/finance.early_settlement.json" with { type: "json" };
import copyPolicyJson from "../policy/copy-policy.json" with { type: "json" };

const OptionSchema = z.object({ key: z.string(), label: z.string().min(1) });

export const TemplateSchema = z.object({
  key: z.string(),
  rulePackKey: z.string(),
  variant: z.enum(["conventional", "islamic"]),
  locale: z.enum(["en", "ar"]),
  severity: z.enum(["info", "caution", "critical"]),
  version: z.number().int().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
  options: z.array(OptionSchema).min(1),
});
export type TemplateDef = z.infer<typeof TemplateSchema> & { variant: Variant; severity: Severity };

const TemplateFileSchema = z.object({
  $comment: z.string().optional(),
  templates: z.array(TemplateSchema),
});

export const CopyPolicySchema = z.object({
  $comment: z.string().optional(),
  version: z.string(),
  bannedTerms: z.object({ en: z.array(z.string()), ar: z.array(z.string()) }),
  islamicForbiddenTerms: z.object({ en: z.array(z.string()), ar: z.array(z.string()) }),
  maxHeadlineChars: z.number().int().positive(),
  maxBodyChars: z.number().int().positive(),
});
export type CopyPolicy = z.infer<typeof CopyPolicySchema>;

export const copyPolicy: CopyPolicy = CopyPolicySchema.parse(copyPolicyJson);

/** All bank-approved demo templates shipped with the implemented packs. */
export const TEMPLATES: TemplateDef[] = [cardCloseTemplates, financeSettlementTemplates].flatMap(
  (file) => TemplateFileSchema.parse(file).templates,
);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Policy violations in a piece of copy: banned selling terms (non-negotiable 4), exclamation
 * marks and emojis (section 15), and conventional terminology in Islamic copy.
 */
export function copyViolations(
  text: string,
  locale: "en" | "ar",
  variant: Variant,
  policy: CopyPolicy = copyPolicy,
): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  const matches = (term: string) =>
    locale === "en"
      ? new RegExp(`(^|[^\\p{L}])${escapeRe(term.toLowerCase())}($|[^\\p{L}])`, "u").test(lower)
      : lower.includes(term);
  for (const term of policy.bannedTerms[locale])
    if (matches(term)) found.push(`banned_term:${term}`);
  if (variant === "islamic") {
    for (const term of policy.islamicForbiddenTerms[locale]) {
      if (matches(term)) found.push(`conventional_term_in_islamic_copy:${term}`);
    }
  }
  if (/[!！]/.test(text)) found.push("exclamation_mark");
  if (/\p{Extended_Pictographic}/u.test(text)) found.push("emoji");
  return found;
}
