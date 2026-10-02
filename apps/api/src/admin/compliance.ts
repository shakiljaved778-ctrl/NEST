import {
  demoContexts,
  loadCustomerBundle,
  type PrismaClient,
  resolvePackInput,
  thresholdsFor,
} from "@amil/db";
import { buildFactTemplate, type ModelGateway, PROMPT_VERSION } from "@amil/gateway";
import { ALL_PACK_DEFINITIONS, getPack } from "@amil/rule-packs";

/**
 * Compliance pack (section 11): model card, data flow, the data fields each pack reads, a real
 * outbound model payload as redaction proof, retention and consent purposes. Generated from the
 * running configuration, so it cannot drift from what the system does.
 */
export async function compliancePack(
  prisma: PrismaClient,
  gateway: ModelGateway,
  bankId: string,
  now: Date,
) {
  const bank = await prisma.bank.findUniqueOrThrow({ where: { id: bankId } });
  const model = gateway.describe();

  // Redaction proof: the exact payload the model would receive for Khalid's card closure.
  let redactionProof: unknown = null;
  const khalid = await prisma.customer.findFirst({
    where: { bankId, personaKey: "khalid" },
    select: { id: true },
  });
  if (khalid) {
    const bundle = await loadCustomerBundle(prisma, khalid.id);
    const ctx = bundle ? demoContexts("card.close", bundle)[0] : undefined;
    const r = bundle && ctx ? resolvePackInput("card.close", bundle, ctx, now) : null;
    if (r) {
      const p = getPack("card.close", r.variant);
      const evaluation = p.evaluate(
        r.input as never,
        p.defaultParameters,
        thresholdsFor(bank.severityThresholds, "card.close"),
        now,
      );
      redactionProof = buildFactTemplate({
        action: "card.close",
        variant: r.variant,
        locale: "en",
        evaluation,
        referenceWording: { headline: "(approved headline)", body: "(approved body)" },
        display: { locale: "en", digitStyle: bank.digitStyle },
      });
    }
  }

  return {
    generatedAt: now.toISOString(),
    bank: { name: bank.name, modelMode: bank.modelMode, digitStyle: bank.digitStyle },
    modelCard: {
      purpose:
        "Words computed facts into approved, plain-language copy (en/ar). Never computes, never decides.",
      modes: {
        redacted:
          "Default. The model sees a de-identified fact template only: no name, customer id, account or card number, IBAN, phone, email or free text.",
        in_country: "A model hosted inside the bank's perimeter receives the same fact template.",
        off: "No model. Every insight uses the bank-approved template wording.",
      },
      currentMode: bank.modelMode,
      providers: { redacted: model.redacted, inCountry: model.inCountry },
      promptVersion: PROMPT_VERSION,
      deadlineMs: model.timeoutMs,
      wordingCache: model.cache
        ? "24 hours, keyed by fact template, template version, prompt and model"
        : "off",
      safeguards: [
        "Number validator: every number, amount, percentage and date in model output must be a computed fact (Arabic-Indic and full-width digits, invisible characters and spelled-out numbers included); otherwise the approved template is served.",
        "Output schema and copy policy: length limits, no selling terms, no exclamation marks or emojis, Sharia terminology in Islamic copy.",
        "Ask AMIL: questions are classified locally and never sent to a model; answers are validated and guarded before they are shown.",
        "Kill switches per rule pack and per template; only approved (Islamic: Sharia-approved) copy is served.",
      ],
    },
    dataFlow: [
      "The bank app calls AMIL before a consequential action (HMAC-signed server call, or a 15-minute widget session).",
      "Consent is checked first; without it only generic product information is returned and no customer data is read.",
      "The rules engine computes every figure from the customer's products and the bank's rules (decimal arithmetic, no model).",
      "The redactor builds a de-identified fact template; in redacted mode only this leaves for the model, and only if the bank enables a model.",
      "The model's wording is validated; on any failure the bank-approved template is used.",
      "The card is returned with sources and as-of dates; options are deep links back into the bank's app (AMIL never executes).",
      "Every evaluation, shown or suppressed, is written to the append-only, hash-chained audit log.",
    ],
    packs: ALL_PACK_DEFINITIONS.map((d) => ({
      key: d.key,
      variant: d.variant,
      version: d.version,
      productFamily: d.productFamily,
      triggers: d.triggers,
      requiredData: d.requiredData,
      facts: d.facts.map((f) => ({
        key: f.key,
        unit: f.unit,
        source: f.source,
        description: f.description,
      })),
    })),
    redaction: {
      neverSent: [
        "Customer.displayName / displayNameAr",
        "Customer.phone / email",
        "Customer.externalRef (audit stores a keyed hash only)",
        "Account.number / iban",
        "Card.pan",
        "Free text typed by the customer",
      ],
      samplePayload: redactionProof,
    },
    retention: {
      auditRetentionYears: bank.auditRetentionYears,
      rule: "Audit events are append-only (database triggers). They can be purged only after their retention date, by a dedicated operation that keeps the hash chain verifiable from its new anchor.",
    },
    consentPurposes: [
      {
        purpose: "pre_decision_insights",
        use: "Pre-action checks, compare views, explain my charge",
      },
      { purpose: "proactive_alerts", use: "Scheduled alerts (rewards expiry, account dormancy)" },
      { purpose: "assistant", use: "Ask AMIL" },
    ],
  };
}
