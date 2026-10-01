import type { Severity, Variant } from "@amil/rules-engine";
import { z } from "zod";
import accountCloseCopy from "../templates/account.close.json" with { type: "json" };
import accountDormancyCopy from "../templates/account.dormancy.json" with { type: "json" };
import cardBalanceTransferCopy from "../templates/card.balance_transfer.json" with { type: "json" };
import cardCashWithdrawalCopy from "../templates/card.cash_withdrawal.json" with { type: "json" };
import cardCloseCopy from "../templates/card.close.json" with { type: "json" };
import cardEppConversionCopy from "../templates/card.epp_conversion.json" with { type: "json" };
import cardMinimumPaymentCopy from "../templates/card.minimum_payment.json" with { type: "json" };
import depositBreakCopy from "../templates/deposit.break.json" with { type: "json" };
import financeEarlySettlementCopy from "../templates/finance.early_settlement.json" with { type: "json" };
import financeTopUpCopy from "../templates/finance.top_up.json" with { type: "json" };
import rewardsExpiryCopy from "../templates/rewards.expiry.json" with { type: "json" };
import salaryTransferChangeCopy from "../templates/salary.transfer_change.json" with { type: "json" };
import copyPolicyJson from "../policy/copy-policy.json" with { type: "json" };

const OptionSchema = z.object({ key: z.string(), label: z.string().min(1) });

export const TemplateSchema = z.object({
  key: z.string(),
  /** insight: computed card; generic: no-consent product information without customer data */
  kind: z.enum(["insight", "generic"]).default("insight"),
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

const LocaleMap = z.object({
  en: z.record(z.string(), z.string()),
  ar: z.record(z.string(), z.string()),
});
const TemplateFileSchema = z.object({
  $comment: z.string().optional(),
  templates: z.array(TemplateSchema),
  factLabels: LocaleMap,
  explanations: LocaleMap,
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

const FILES = {
  "account.close": TemplateFileSchema.parse(accountCloseCopy),
  "account.dormancy": TemplateFileSchema.parse(accountDormancyCopy),
  "card.balance_transfer": TemplateFileSchema.parse(cardBalanceTransferCopy),
  "card.cash_withdrawal": TemplateFileSchema.parse(cardCashWithdrawalCopy),
  "card.close": TemplateFileSchema.parse(cardCloseCopy),
  "card.epp_conversion": TemplateFileSchema.parse(cardEppConversionCopy),
  "card.minimum_payment": TemplateFileSchema.parse(cardMinimumPaymentCopy),
  "deposit.break": TemplateFileSchema.parse(depositBreakCopy),
  "finance.early_settlement": TemplateFileSchema.parse(financeEarlySettlementCopy),
  "finance.top_up": TemplateFileSchema.parse(financeTopUpCopy),
  "rewards.expiry": TemplateFileSchema.parse(rewardsExpiryCopy),
  "salary.transfer_change": TemplateFileSchema.parse(salaryTransferChangeCopy),
} as const;
type PackWithCopy = keyof typeof FILES;

/** Every bank-approved demo template (insight and generic) shipped with the implemented packs. */
export const ALL_TEMPLATES: TemplateDef[] = Object.values(FILES).flatMap((f) => f.templates);
/** Insight templates: exactly one per pack x variant x locale x severity. */
export const TEMPLATES: TemplateDef[] = ALL_TEMPLATES.filter((t) => t.kind === "insight");
/** No-consent templates: one per pack x variant x locale, no placeholders. */
export const GENERIC_TEMPLATES: TemplateDef[] = ALL_TEMPLATES.filter((t) => t.kind === "generic");

function copyFor(packKey: string): (typeof FILES)[PackWithCopy] | undefined {
  return (FILES as Record<string, (typeof FILES)[PackWithCopy]>)[packKey];
}

/** Approved label for a fact chip (falls back to the fact key, which tests prevent). */
export function factLabel(packKey: string, locale: "en" | "ar", factKey: string): string {
  return copyFor(packKey)?.factLabels[locale][factKey] ?? factKey;
}

/**
 * Normalise an explanation code to its copy key: parameters are dropped and digits become N
 * ("points_expiring_within_90_days" -> "points_expiring_within_N_days", "severity:critical" ->
 * "severity_critical"). Codes carrying amounts ("severity_basis_qar:...") have no copy.
 */
export function explanationKey(code: string): string | null {
  if (code.startsWith("severity_basis")) return null;
  return code.replace(":", "_").replace(/\d+/g, "N");
}

/** Approved "Why am I seeing this?" sentences for an evaluation's explanation codes. */
export function explain(packKey: string, locale: "en" | "ar", codes: string[]): string[] {
  const copy = copyFor(packKey)?.explanations[locale] ?? {};
  return codes
    .map(explanationKey)
    .filter((k): k is string => k !== null)
    .map((k) => copy[k])
    .filter((s): s is string => typeof s === "string");
}

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
