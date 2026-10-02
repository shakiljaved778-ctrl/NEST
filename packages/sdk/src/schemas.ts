/**
 * AMIL API contract (section 7). These Zod schemas validate every request in the API and
 * generate the OpenAPI 3.1 document served at /docs. Clients get the inferred types.
 */
import { z } from "zod";

export const Locale = z.enum(["en", "ar"]).meta({ id: "Locale" });
export const Severity = z.enum(["info", "caution", "critical"]).meta({ id: "Severity" });
export const CheckAction = z
  .enum([
    "card.close",
    "finance.early_settlement",
    "finance.top_up",
    "card.cash_withdrawal",
    "card.minimum_payment",
    "card.epp_conversion",
    "card.balance_transfer",
    "deposit.break",
    "salary.transfer_change",
    "account.close",
  ])
  .meta({
    id: "CheckAction",
    description:
      "The customer action about to be confirmed. Proactive packs (account.dormancy, rewards.expiry) run on AMIL's schedule and reach the customer as alerts.",
  });
export const AlertPack = z.enum(["account.dormancy", "rewards.expiry"]).meta({ id: "AlertPack" });
export const Scope = z
  .enum([
    "checks:write",
    "insights:respond",
    "consents:read",
    "consents:write",
    "alerts:read",
    "charges:explain",
    "compare:read",
    "assistant:chat",
  ])
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
const Amount = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,2})?$/)
  .meta({
    description: "QAR amount as a decimal string (never a JSON number)",
    example: "1000.00",
  });

export const CheckContext = z
  .object({
    cardId: ProductId.optional(),
    financeId: ProductId.optional(),
    depositId: ProductId.optional(),
    accountId: ProductId.optional(),
    transactionId: ProductId.optional(),
    amount: Amount.optional(),
    paymentAmount: Amount.optional(),
    months: z.number().int().min(1).max(360).optional(),
  })
  .strict()
  .meta({
    id: "CheckContext",
    description: [
      "What the action is about. Required per action:",
      "card.close, card.minimum_payment: cardId (minimum_payment: optional paymentAmount to compare);",
      "card.cash_withdrawal, card.balance_transfer: cardId + amount;",
      "card.epp_conversion: cardId + transactionId (+ months, default 6);",
      "finance.early_settlement: financeId; finance.top_up: financeId + amount (+ months, default 60);",
      "deposit.break: depositId; account.close: accountId; salary.transfer_change: none.",
    ].join(" "),
  });

export const CheckRequest = z
  .object({
    action: CheckAction,
    customerRef: CustomerRef,
    context: CheckContext,
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

// ── Alerts ────────────────────────────────────────────────────────────────────────────────────
export const Alert = z
  .object({
    id: z.string(),
    rulePackKey: AlertPack,
    severity: Severity,
    createdAt: z.string().meta({ format: "date-time" }),
    readAt: z.string().meta({ format: "date-time" }).nullable(),
    insight: CheckResponse.meta({
      description: "The card as computed by the scheduled run; render it with <amil-insight>.",
    }),
  })
  .meta({ id: "Alert" });
export const AlertList = z
  .object({ customerRef: z.string(), unread: z.number().int(), alerts: z.array(Alert) })
  .meta({ id: "AlertList" });
export const AlertListQuery = z
  .object({ customerRef: CustomerRef, locale: Locale.optional() })
  .strict()
  .meta({ id: "AlertListQuery" });

// ── Explain my charge ─────────────────────────────────────────────────────────────────────────
export const ExplainChargeRequest = z
  .object({ customerRef: CustomerRef, transactionId: ProductId, locale: Locale.optional() })
  .strict()
  .meta({ id: "ExplainChargeRequest" });
export const ChargeCalculation = z
  .object({
    kind: z.enum(["fixed", "percentage", "rate_on_balance", "per_product"]),
    lines: z.array(z.object({ label: z.string(), display: z.string() })),
    matches: z.boolean().nullable().meta({
      description:
        "Whether the charge equals what the published fee rule gives (null when it cannot be recomputed from the statement alone)",
    }),
  })
  .meta({ id: "ChargeCalculation" });
export const ChargeExplanation = z
  .object({
    explanationId: z.string(),
    kind: z.enum(["charge", "generic", "none"]).meta({
      description:
        "charge: explained from the fee schedule and the customer's transactions; generic: no consent, the fee schedule entry only; none: not a fee line",
    }),
    feeCode: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    amount: FactChip.nullable(),
    postedAt: z.string().nullable(),
    calculation: ChargeCalculation.nullable(),
    avoidTip: z.string().nullable(),
    disclosure: z.string(),
  })
  .meta({ id: "ChargeExplanation" });

// ── Compare ───────────────────────────────────────────────────────────────────────────────────
export const CompareScenario = z
  .enum(["settlement_timing", "min_vs_custom_payment", "deposit_break_vs_wait"])
  .meta({ id: "CompareScenario" });
export const CompareRequest = z
  .object({
    customerRef: CustomerRef,
    scenario: CompareScenario,
    params: z
      .object({
        financeId: ProductId.optional(),
        cardId: ProductId.optional(),
        depositId: ProductId.optional(),
        paymentAmount: Amount.optional(),
      })
      .strict()
      .meta({
        description:
          "settlement_timing: financeId; min_vs_custom_payment: cardId (+ paymentAmount); deposit_break_vs_wait: depositId",
      }),
    locale: Locale.optional(),
  })
  .strict()
  .meta({ id: "CompareRequest" });
export const CompareOption = z
  .object({
    key: z.string(),
    title: z.string(),
    best: z.boolean().meta({ description: "The lowest-cost (or highest-value) option" }),
    facts: z.array(FactChip),
    action: CardOption.nullable().meta({ description: "Bank deep link to act on this option" }),
  })
  .meta({ id: "CompareOption" });
export const CompareResponse = z
  .object({
    compareId: z.string(),
    scenario: CompareScenario,
    kind: z.enum(["comparison", "generic", "none"]),
    headline: z.string().nullable(),
    body: z.string().nullable(),
    options: z.array(CompareOption),
    actions: z.array(CardOption),
    disclosure: z.string(),
  })
  .meta({ id: "CompareResponse" });

// ── Ask AMIL ──────────────────────────────────────────────────────────────────────────────────
export const AssistantContext = CheckContext.extend({
  topic: z
    .string()
    .max(64)
    .regex(/^[a-z_.]+$/)
    .optional(),
})
  .strict()
  .meta({
    id: "AssistantContext",
    description: "Set when the customer taps a suggestion (topic + product), never free text",
  });
export const AssistantMessageRequest = z
  .object({
    customerRef: CustomerRef,
    message: z.string().trim().min(1).max(500),
    conversationId: z.string().uuid().optional(),
    context: AssistantContext.optional(),
    locale: Locale.optional(),
  })
  .strict()
  .meta({ id: "AssistantMessageRequest" });
export const AssistantSuggestion = z
  .object({ label: z.string(), message: z.string(), context: AssistantContext.optional() })
  .meta({ id: "AssistantSuggestion" });
export const AssistantAnswer = z
  .object({
    messageId: z.string(),
    conversationId: z.string(),
    intent: z.string(),
    kind: z.enum([
      "insight",
      "comparison",
      "charge",
      "faq",
      "products",
      "clarify",
      "refusal",
      "help",
      "no_consent",
      "nothing",
      "unknown",
    ]),
    severity: Severity.nullable(),
    headline: z.string(),
    body: z.string(),
    details: z
      .array(z.string())
      .meta({ description: "Further approved paragraphs (FAQ, fee schedule)" }),
    why: z.array(z.string()).meta({ description: "Approved 'Why am I seeing this?' reasons" }),
    facts: z.array(FactChip),
    options: z.array(CardOption),
    suggestions: z.array(AssistantSuggestion),
    comparison: CompareResponse.nullable(),
    aiDisclosure: z.string(),
  })
  .meta({ id: "AssistantAnswer" });
/** Server-sent events of POST /v1/assistant/messages, in order: status*, delta*, answer, done. */
export const AssistantStreamEvent = z.discriminatedUnion("event", [
  z.object({ event: z.literal("status"), data: z.object({ step: z.string() }) }),
  z.object({ event: z.literal("delta"), data: z.object({ text: z.string() }) }),
  z.object({ event: z.literal("answer"), data: AssistantAnswer }),
  z.object({ event: z.literal("error"), data: z.object({ error: z.string() }) }),
  z.object({ event: z.literal("done"), data: z.object({}) }),
]);

// ── Inbound product events (bank -> AMIL) ─────────────────────────────────────────────────────
export const EventType = z
  .enum([
    "transaction.posted",
    "account.updated",
    "card.updated",
    "finance.updated",
    "deposit.updated",
    "customer.updated",
  ])
  .meta({ id: "EventType" });
export const EventRequest = z
  .object({
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/)
      .meta({
        description: "Unique per event; a retry with the same key is acknowledged, not re-recorded",
      }),
    type: EventType,
    occurredAt: z.string().datetime().meta({ format: "date-time" }),
    customerRef: CustomerRef.optional(),
    payload: z.record(z.string(), z.unknown()).meta({
      description: "Event body (decimal strings for money). Kept in-country with the bank's data.",
    }),
  })
  .strict()
  .meta({ id: "EventRequest" });
export const EventAck = z
  .object({
    eventId: z.string(),
    idempotencyKey: z.string(),
    receivedAt: z.string().meta({ format: "date-time" }),
    duplicate: z.boolean().meta({ description: "true when this key was already recorded" }),
  })
  .meta({ id: "EventAck" });

// ── Responses ─────────────────────────────────────────────────────────────────────────────────
export const InsightResponseRequest = z
  .object({ action: ResponseAction, optionKey: z.string().max(64).optional() })
  .strict()
  .meta({ id: "InsightResponseRequest" });
export const InsightResponseAck = z
  .object({ id: z.string(), insightId: z.string(), action: ResponseAction, at: z.string() })
  .meta({ id: "InsightResponseAck" });

export type Locale = z.infer<typeof Locale>;
export type Severity = z.infer<typeof Severity>;
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
export type CheckContext = z.infer<typeof CheckContext>;
export type EventRequest = z.infer<typeof EventRequest>;
export type CompareScenario = z.infer<typeof CompareScenario>;
export type CompareRequest = z.infer<typeof CompareRequest>;
export type CompareOption = z.infer<typeof CompareOption>;
export type CardOption = z.infer<typeof CardOption>;
export type CompareResponse = z.infer<typeof CompareResponse>;
export type AssistantContext = z.infer<typeof AssistantContext>;
export type AssistantMessageRequest = z.infer<typeof AssistantMessageRequest>;
export type AssistantSuggestion = z.infer<typeof AssistantSuggestion>;
export type AssistantAnswer = z.infer<typeof AssistantAnswer>;
export type AssistantStreamEvent = z.infer<typeof AssistantStreamEvent>;
export type EventAck = z.infer<typeof EventAck>;
export type AlertPack = z.infer<typeof AlertPack>;
export type Alert = z.infer<typeof Alert>;
export type AlertList = z.infer<typeof AlertList>;
export type AlertListQuery = z.infer<typeof AlertListQuery>;
export type ExplainChargeRequest = z.infer<typeof ExplainChargeRequest>;
export type ChargeCalculation = z.infer<typeof ChargeCalculation>;
export type ChargeExplanation = z.infer<typeof ChargeExplanation>;

export const DEFAULT_SESSION_SCOPES: Scope[] = [
  "checks:write",
  "insights:respond",
  "consents:read",
  "consents:write",
  "alerts:read",
  "charges:explain",
  "compare:read",
  "assistant:chat",
];

/** Bank console staff (`/v1/admin/*`). The console backend signs them in over HMAC. */
export const ConsoleRole = z.enum(["admin", "product", "compliance", "sharia", "viewer"]);
export const ConsoleUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: ConsoleRole,
});
export const ConsoleUserList = z.object({ users: z.array(ConsoleUser) });
export const ConsoleSessionResponse = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: ConsoleUser,
  permissions: z.array(z.string()),
});
export type ConsoleRole = z.infer<typeof ConsoleRole>;
export type ConsoleUser = z.infer<typeof ConsoleUser>;
export type ConsoleSessionResponse = z.infer<typeof ConsoleSessionResponse>;

/** HTTP headers for bank-to-AMIL calls. */
export const HEADERS = {
  key: "x-amil-key",
  timestamp: "x-amil-timestamp",
  signature: "x-amil-signature",
  nonce: "x-amil-nonce",
} as const;

/** An optional nonce: 16-64 letters, digits or hyphens (a UUID fits). */
export const NONCE_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

/**
 * Signing input: timestamp, method, path and raw body (D-016), then the nonce when one is sent
 * (D-063). The nonce lets two identical requests in the same second both be accepted; it is
 * signed, so it cannot be added to or stripped from a captured request.
 */
export function signingString(
  timestamp: string,
  method: string,
  path: string,
  body: string,
  nonce?: string,
): string {
  const base = `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
  return nonce ? `${base}.${nonce}` : base;
}
