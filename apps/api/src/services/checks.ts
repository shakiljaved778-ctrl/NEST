import { randomUUID } from "node:crypto";
import {
  type AuditEventContent,
  appendInsightEvent,
  canonicalJson,
  hashCustomerRef,
  type PrismaClient,
  sha256,
  thresholdsFor,
  toCardCloseInput,
  toFinanceSettlementInput,
} from "@amil/db";
import {
  type ModelGateway,
  formatFact,
  TemplateRenderError,
  type WordingResult,
} from "@amil/gateway";
import { formatDate, messages } from "@amil/i18n";
import {
  CardCloseParamsSchema,
  cardClosePacks,
  explain,
  factLabel,
  FinanceSettlementParamsSchema,
  financeEarlySettlementPacks,
  isTruthyFact,
  templateFactKeys,
  variantForFinanceType,
} from "@amil/rule-packs";
import type { AnyEvaluation, SeverityThresholds, Variant } from "@amil/rules-engine";
import type { CheckRequest, CheckResponse, FactChip, InsightCard } from "@amil/sdk";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { notFound } from "../errors";
import { deepLink, isOptionKey } from "./deeplinks";

export interface CheckDeps {
  prisma: PrismaClient;
  gateway: ModelGateway;
  auditHashSecret: string;
  clock: () => Date;
  log: FastifyBaseLogger;
}

type Locale = "en" | "ar";
type Bank = NonNullable<Awaited<ReturnType<PrismaClient["bank"]["findUnique"]>>>;

interface Prepared {
  variant: Variant;
  defaultParameters: object;
  schema: z.ZodType;
  /** Pure evaluation of the adapted input; also returns the hash of the input snapshot. */
  evaluate: (
    params: unknown,
    thresholds: SeverityThresholds,
    now: Date,
  ) => { evaluation: AnyEvaluation; inputHash: string };
}

const OptionsSchema = z.array(z.object({ key: z.string(), label: z.string() }));

/**
 * POST /v1/checks. Order of gates:
 *   consent (non-negotiable 5) -> rule-pack kill switch (9) -> evaluation (1) ->
 *   approved, enabled template (8, 9) -> gateway wording (2, 6) -> audit (7).
 * Any gate that closes yields "no insight", never an error, so the bank's flow continues.
 */
export async function runCheck(
  deps: CheckDeps,
  bankId: string,
  req: CheckRequest,
  sessionLocale?: Locale,
): Promise<CheckResponse> {
  const started = performance.now();
  const now = deps.clock();
  const bank = await deps.prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) throw notFound();
  const customer = await deps.prisma.customer.findUnique({
    where: { bankId_externalRef: { bankId, externalRef: req.customerRef } },
    select: { id: true, preferredLocale: true },
  });
  if (!customer) throw notFound();

  const locale: Locale = req.locale ?? sessionLocale ?? customer.preferredLocale;
  const customerRefHash = hashCustomerRef(deps.auditHashSecret, bankId, req.customerRef);
  const insightId = randomUUID();
  const base = {
    id: insightId,
    bankId,
    occurredAt: now,
    trigger: `action:${req.action}`,
    customerRefHash,
    rulePackKey: req.action,
    locale,
    retentionUntil: new Date(
      Date.UTC(
        now.getUTCFullYear() + bank.auditRetentionYears,
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    ),
  };
  const audit = async (fields: Omit<AuditEventContent, keyof typeof base | "latencyMs">) =>
    appendInsightEvent(deps.prisma, {
      ...base,
      ...fields,
      latencyMs: Math.round(performance.now() - started),
    });

  // ── Consent first: without it, read no customer data and show generic information only ──
  const consent = await deps.prisma.consent.findFirst({
    where: { customerId: customer.id, purpose: "pre_decision_insights", withdrawnAt: null },
    select: { id: true },
  });
  if (!consent) return genericResponse(deps, bank, req, locale, insightId, audit);

  const prepared = await prepare(deps, customer.id, req);

  // ── Kill switch and parameters (latest active version effective now) ──
  const packRow = await deps.prisma.rulePack.findFirst({
    where: {
      bankId,
      key: req.action,
      variant: prepared.variant,
      status: "active",
      effectiveFrom: { lte: now },
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  const suppressed = async (reason: string, extra: Partial<AuditEventContent> = {}) => {
    deps.log.info({ action: req.action, reason }, "insight_suppressed");
    await audit({
      rulePackVersion: packRow?.version ?? "n/a",
      variant: prepared.variant,
      inputSnapshotHash: "",
      applicable: false,
      severity: null,
      facts: {},
      templateKey: null,
      templateVersion: null,
      modelProvider: null,
      modelVersion: null,
      validatorResult: "not_used",
      shown: { suppressed: reason },
      ...extra,
    });
    return none(insightId);
  };
  if (!packRow || !packRow.enabled) return suppressed("rule_pack_disabled");

  const params = prepared.schema.safeParse({
    ...prepared.defaultParameters,
    ...(packRow.parameters as object),
  });
  if (!params.success) {
    deps.log.error(
      { action: req.action, version: packRow.version },
      "rule_pack_parameters_invalid",
    );
    return suppressed("rule_pack_parameters_invalid");
  }

  // ── Evaluate (pure) ──
  const { evaluation, inputHash } = prepared.evaluate(
    params.data,
    thresholdsFor(bank.severityThresholds, req.action),
    now,
  );
  const evaluated = {
    rulePackVersion: packRow.version,
    variant: prepared.variant,
    inputSnapshotHash: inputHash,
    facts: stripSources(evaluation),
  };
  if (!evaluation.applicable) {
    await audit({
      ...evaluated,
      applicable: false,
      severity: evaluation.severity,
      templateKey: null,
      templateVersion: null,
      modelProvider: null,
      modelVersion: null,
      validatorResult: "not_used",
      shown: { suppressed: "not_applicable" },
    });
    return none(insightId);
  }

  // ── Approved, enabled template ──
  const templateKey = `${req.action}.${prepared.variant}.${evaluation.severity}`;
  const template = await findTemplate(deps, bankId, templateKey, locale, prepared.variant);
  if (!template)
    return suppressed("template_unavailable", { ...evaluated, severity: evaluation.severity });

  // ── Wording ──
  let wording: WordingResult;
  try {
    wording = await deps.gateway.word({
      action: req.action,
      variant: prepared.variant,
      locale,
      evaluation,
      template: {
        key: template.key,
        version: template.version,
        headline: template.headline,
        body: template.body,
      },
      modelMode: bank.modelMode,
      display: { locale, digitStyle: bank.digitStyle },
    });
  } catch (error) {
    if (error instanceof TemplateRenderError)
      return suppressed("template_render_failed", { ...evaluated, severity: evaluation.severity });
    throw error;
  }

  const card = buildCard(bank, req, locale, evaluation, template, wording);
  const aiUsed = wording.source !== "template" && wording.provider !== "mock";
  await audit({
    ...evaluated,
    applicable: true,
    severity: evaluation.severity,
    templateKey: template.key,
    templateVersion: template.version,
    modelProvider: wording.source === "template" ? null : wording.provider,
    modelVersion: wording.source === "template" ? null : wording.model,
    validatorResult: wording.validatorResult,
    shown: {
      ...card,
      wordingSource: wording.source,
      aiAssisted: aiUsed,
      explanation: evaluation.explanation,
      wordingRejections: wording.reasons,
    },
  });

  return {
    insightId,
    applicable: true,
    kind: "insight",
    severity: evaluation.severity,
    card,
    requiresAcknowledgement: evaluation.severity === "critical",
  };
}

function none(insightId: string): CheckResponse {
  return {
    insightId,
    applicable: false,
    kind: "none",
    severity: null,
    card: null,
    requiresAcknowledgement: false,
  };
}

/** Facts as audited, including `_sources` (where each figure came from). */
function stripSources(evaluation: AnyEvaluation): Record<string, unknown> {
  return { ...evaluation.facts };
}

async function prepare(deps: CheckDeps, customerId: string, req: CheckRequest): Promise<Prepared> {
  if (req.action === "card.close") {
    if (!req.context.cardId) throw notFound();
    const card = await deps.prisma.card.findFirst({
      where: { id: req.context.cardId, customerId, status: "active" },
      include: { rewards: true, instalmentPlans: true },
    });
    if (!card) throw notFound();
    const pack = cardClosePacks[card.type];
    return {
      variant: card.type,
      defaultParameters: pack.defaultParameters,
      schema: CardCloseParamsSchema,
      evaluate: (params, thresholds, now) => {
        const input = toCardCloseInput(card, card.rewards, card.instalmentPlans, now);
        return {
          evaluation: pack.evaluate(
            input,
            params as typeof pack.defaultParameters,
            thresholds,
            now,
          ),
          inputHash: sha256(canonicalJson(input)),
        };
      },
    };
  }
  if (!req.context.financeId) throw notFound();
  const finance = await deps.prisma.finance.findFirst({
    where: { id: req.context.financeId, customerId, status: "active" },
  });
  if (!finance) throw notFound();
  const variant = variantForFinanceType(finance.type);
  const pack = financeEarlySettlementPacks[variant];
  return {
    variant,
    defaultParameters: pack.defaultParameters,
    schema: FinanceSettlementParamsSchema,
    evaluate: (params, thresholds, now) => {
      const input = toFinanceSettlementInput(finance, now);
      return {
        evaluation: pack.evaluate(input, params as typeof pack.defaultParameters, thresholds, now),
        inputHash: sha256(canonicalJson(input)),
      };
    },
  };
}

/** Approved (Islamic: Sharia-approved), enabled template, latest version (non-negotiables 8, 9). */
async function findTemplate(
  deps: CheckDeps,
  bankId: string,
  key: string,
  locale: Locale,
  variant: Variant,
) {
  return deps.prisma.template.findFirst({
    where: {
      bankId,
      key,
      locale,
      enabled: true,
      status: { in: variant === "islamic" ? ["sharia_approved"] : ["approved", "sharia_approved"] },
    },
    orderBy: { version: "desc" },
  });
}

type TemplateRow = NonNullable<Awaited<ReturnType<typeof findTemplate>>>;

function latestAsOf(evaluation: AnyEvaluation): string {
  return (
    evaluation.facts._sources
      .map((s) => s.asOf)
      .sort()
      .at(-1) ?? ""
  );
}

function buildCard(
  bank: Bank,
  req: CheckRequest,
  locale: Locale,
  evaluation: AnyEvaluation,
  template: TemplateRow,
  wording: WordingResult,
): InsightCard {
  const display = { locale, digitStyle: bank.digitStyle };
  const referenced = [template.headline, template.body].flatMap((t) => {
    const k = templateFactKeys(t);
    return [...k.placeholders, ...k.sections];
  });
  const facts: FactChip[] = [];
  for (const key of new Set(referenced)) {
    const raw = evaluation.facts[key];
    if (!raw || Array.isArray(raw)) continue;
    const fact = raw;
    if (!isTruthyFact(fact) || fact.unit === "boolean") continue;
    facts.push({
      key,
      label: factLabel(req.action, locale, key),
      value: fact.value,
      display: formatFact(fact, display),
      unit: fact.unit,
      source: fact.source,
      asOf: fact.asOf,
    });
  }

  const allowed = new Set(evaluation.options);
  const options = OptionsSchema.parse(template.options)
    .filter((o) => isOptionKey(o.key) && allowed.has(o.key))
    .map((o) => ({
      key: o.key,
      label: o.label,
      deepLink: deepLink(
        bank.deepLinkScheme,
        o.key as Parameters<typeof deepLink>[1],
        { action: req.action, ...req.context },
        evaluation.facts,
      ),
    }));

  const m = messages[locale].insight;
  const bankName = locale === "ar" ? bank.nameAr : bank.name;
  const asOf = latestAsOf(evaluation);
  const figures = m.footerFigures
    .replace("{bankName}", bankName)
    .replace("{asOf}", asOf ? formatDate(asOf, display) : "");
  const aiUsed = wording.source !== "template" && wording.provider !== "mock";

  return {
    headline: wording.headline,
    body: wording.body,
    facts,
    options,
    why: explain(req.action, locale, evaluation.explanation),
    aiDisclosure: aiUsed ? `${figures} ${m.footerAi}` : figures,
  };
}

/**
 * No consent on record: product-level information only. Nothing about the customer's products is
 * read, so the variant-neutral conventional generic copy is used (D-019).
 */
async function genericResponse(
  deps: CheckDeps,
  bank: Bank,
  req: CheckRequest,
  locale: Locale,
  insightId: string,
  audit: (
    fields: Omit<
      AuditEventContent,
      | "id"
      | "bankId"
      | "occurredAt"
      | "trigger"
      | "customerRefHash"
      | "rulePackKey"
      | "locale"
      | "retentionUntil"
      | "latencyMs"
    >,
  ) => Promise<unknown>,
): Promise<CheckResponse> {
  const template = await findTemplate(
    deps,
    bank.id,
    `${req.action}.conventional.generic`,
    locale,
    "conventional",
  );
  const common = {
    rulePackVersion: "n/a",
    variant: "conventional" as const,
    inputSnapshotHash: sha256(canonicalJson({ action: req.action })),
    facts: {},
    templateVersion: template?.version ?? null,
    modelProvider: null,
    modelVersion: null,
    validatorResult: "not_used" as const,
  };
  if (!template) {
    await audit({
      ...common,
      applicable: false,
      severity: null,
      templateKey: null,
      shown: { suppressed: "no_consent_generic_template_unavailable" },
    });
    return none(insightId);
  }
  const options = OptionsSchema.parse(template.options)
    .filter((o) => isOptionKey(o.key))
    .map((o) => ({
      ...o,
      deepLink: deepLink(
        bank.deepLinkScheme,
        o.key as Parameters<typeof deepLink>[1],
        { action: req.action, ...req.context },
        null,
      ),
    }));
  const card: InsightCard = {
    headline: template.headline,
    body: template.body,
    facts: [],
    options,
    why: [],
    aiDisclosure: messages[locale].insight.genericFooter,
  };
  await audit({
    ...common,
    applicable: true,
    severity: "info",
    templateKey: template.key,
    shown: { ...card, wordingSource: "template", consent: "absent" },
  });
  return {
    insightId,
    applicable: true,
    kind: "generic",
    severity: "info",
    card,
    requiresAcknowledgement: false,
  };
}
