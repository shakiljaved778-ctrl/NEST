/**
 * AMIL API contract (section 7). These Zod schemas validate every request in the API and
 * generate the OpenAPI 3.1 document served at /docs. Clients get the inferred types.
 */
import { z } from "zod";

export const Locale = z.enum(["en", "ar"]).meta({ id: "Locale" });
export const Severity = z.enum(["info", "caution", "critical"]).meta({ id: "Severity" });
export const CheckAction = z.enum(["card.close", "finance.early_settlement"]).meta({
  id: "CheckAction",
  description: "The customer action about to be confirmed. More actions arrive with Phase 5 packs.",
});
export const Scope = z
  .enum(["checks:write", "insights:respond", "consents:read", "consents:write"])
  .meta({ id: "Scope" });
export const ConsentPurpose = z
  .enum(["pre_decision_insights", "proactive_alerts", "assistant"])
  .meta({ id: "ConsentPurpose" });
export const ConsentMethod = z
  .enum(["in_app", "online_banking", "branch", "api"])
  .meta({ id: "ConsentMethod" });
export const ResponseAction = z
  .enum(["continued", "chose_option", "talk_to_someone", "dismissed"])
  .meta({ id: "ResponseAction" });

const CustomerRef = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._:-]+$/)
  .meta({ description: "The bank's own customer reference", example: "DDB-C-0001" });
const ProductId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const ErrorResponse = z.object({ error: z.string() }).meta({ id: "Error" });

// ── Sessions ──────────────────────────────────────────────────────────────────────────────────
export const SessionRequest = z
  .object({
    customerRef: CustomerRef,
    locale: Locale.optional(),
    scopes: z.array(Scope).min(1).optional(),
  })
  .strict()
  .meta({ id: "SessionRequest" });
export const SessionResponse = z
  .object({
    token: z.string(),
    expiresAt: z.string().meta({ format: "date-time" }),
    scopes: z.array(Scope),
  })
  .meta({ id: "SessionResponse" });

// ── Consents ──────────────────────────────────────────────────────────────────────────────────
export const ConsentRequest = z
  .object({
    customerRef: CustomerRef,
    purpose: ConsentPurpose,
    version: z.string().min(1).max(16),
    method: ConsentMethod,
    privacyPolicyVersion: z.string().min(1).max(32),
  })
  .strict()
  .meta({ id: "ConsentRequest" });
export const Consent = z
  .object({
    id: z.string(),
    purpose: ConsentPurpose,
    version: z.string(),
    method: ConsentMethod,
    grantedAt: z.string().meta({ format: "date-time" }),
    withdrawnAt: z.string().meta({ format: "date-time" }).nullable(),
    privacyPolicyVersion: z.string(),
  })
  .meta({ id: "Consent" });
export const ConsentList = z
  .object({ customerRef: z.string(), consents: z.array(Consent) })
  .meta({ id: "ConsentList" });

// ── Checks ────────────────────────────────────────────────────────────────────────────────────
export const CheckRequest = z
  .object({
    action: CheckAction,
    customerRef: CustomerRef,
    context: z
      .object({ cardId: ProductId.optional(), financeId: ProductId.optional() })
      .strict()
      .meta({ description: "cardId for card actions, financeId for finance actions" }),
    locale: Locale.optional(),
  })
  .strict()
  .meta({ id: "CheckRequest" });

export const FactChip = z
  .object({
    key: z.string(),
    label: z.string(),
    value: z
      .string()
      .meta({ description: "Canonical value: decimal string, ISO date, true/false" }),
    display: z
      .string()
      .meta({ description: "Localised display text, exactly as used in the card" }),
    unit: z.string(),
    source: z.string(),
    asOf: z.string(),
  })
  .meta({ id: "FactChip" });

export const CardOption = z
  .object({
    key: z.string(),
    label: z.string(),
    deepLink: z.string().meta({
      description: "Bank deep link, e.g. ddb://cards/{id}/rewards. AMIL never executes actions.",
    }),
  })
  .meta({ id: "CardOption" });

export const InsightCard = z
  .object({
    headline: z.string(),
    body: z.string(),
    facts: z.array(FactChip),
    options: z.array(CardOption),
    why: z.array(z.string()),
    aiDisclosure: z.string(),
  })
  .meta({ id: "InsightCard" });

export const CheckResponse = z
  .object({
    insightId: z.string(),
    applicable: z.boolean(),
    kind: z.enum(["insight", "generic", "none"]).meta({
      description:
        "insight: computed from the customer's products; generic: no consent on record, product information only; none: nothing to show",
    }),
    severity: Severity.nullable(),
    card: InsightCard.nullable(),
    requiresAcknowledgement: z.boolean(),
  })
  .meta({ id: "CheckResponse" });

// ── Responses ─────────────────────────────────────────────────────────────────────────────────
export const InsightResponseRequest = z
  .object({ action: ResponseAction, optionKey: z.string().max(64).optional() })
  .strict()
  .meta({ id: "InsightResponseRequest" });
export const InsightResponseAck = z
  .object({ id: z.string(), insightId: z.string(), action: ResponseAction, at: z.string() })
  .meta({ id: "InsightResponseAck" });

export type Locale = z.infer<typeof Locale>;
export type Scope = z.infer<typeof Scope>;
export type CheckAction = z.infer<typeof CheckAction>;
export type SessionRequest = z.infer<typeof SessionRequest>;
export type SessionResponse = z.infer<typeof SessionResponse>;
export type ConsentRequest = z.infer<typeof ConsentRequest>;
export type Consent = z.infer<typeof Consent>;
export type ConsentList = z.infer<typeof ConsentList>;
export type CheckRequest = z.infer<typeof CheckRequest>;
export type CheckResponse = z.infer<typeof CheckResponse>;
export type InsightCard = z.infer<typeof InsightCard>;
export type FactChip = z.infer<typeof FactChip>;
export type InsightResponseRequest = z.infer<typeof InsightResponseRequest>;
export type InsightResponseAck = z.infer<typeof InsightResponseAck>;

export const DEFAULT_SESSION_SCOPES: Scope[] = [
  "checks:write",
  "insights:respond",
  "consents:read",
  "consents:write",
];

/** HTTP headers for bank-to-AMIL calls. */
export const HEADERS = {
  key: "x-amil-key",
  timestamp: "x-amil-timestamp",
  signature: "x-amil-signature",
} as const;

/** Signing input: timestamp, method, path and raw body (D-016). */
export function signingString(
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  return `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
}
