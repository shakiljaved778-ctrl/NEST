import { randomUUID } from "node:crypto";
import {
  type AuditEventContent,
  appendInsightEvent,
  canonicalJson,
  hashCustomerRef,
  type PrismaClient,
  loadCustomerBundle,
  PACK_REQUIRED_CONTEXT,
  type PackContext,
  resolvePackInput,
  sha256,
  thresholdsFor,
} from "@amil/db";
import {
  type ModelGateway,
  formatFact,
  TemplateRenderError,
  type WordingResult,
} from "@amil/gateway";
import { formatDate, messages } from "@amil/i18n";
import {
  explain,
  factLabel,
  getPack,
  isTruthyFact,
  type PackKey,
  renderedFactKeys,
} from "@amil/rule-packs";
import type { AnyEvaluation, Variant } from "@amil/rules-engine";
import type { CheckRequest, CheckResponse, FactChip, InsightCard } from "@amil/sdk";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { badRequest, notFound } from "../errors";
import { deepLink, isOptionKey } from "./deeplinks";

export interface CheckDeps {
  prisma: PrismaClient;
  gateway: ModelGateway;
  auditHashSecret: string;
  clock: () => Date;
  log: FastifyBaseLogger;
}

export type Locale = "en" | "ar";
export type Bank = NonNullable<Awaited<ReturnType<PrismaClient["bank"]["findUnique"]>>>;

/** What an insight is about, independent of how it was triggered (a check or a schedule). */
export interface InsightSubject {
  packKey: PackKey;
  variant: Variant;
  input: unknown;
  /** The bank's context, used to build deep links (cardId, amount, …). */
  context: PackContext;
}

export type Audit = (
  fields: Omit<AuditEventContent, AuditBaseKey | "latencyMs">,
) => ReturnType<typeof appendInsightEvent>;
type AuditBaseKey =
  | "id"
  | "bankId"
  | "occurredAt"
  | "trigger"
  | "customerRefHash"
  | "rulePackKey"
  | "locale"
  | "retentionUntil";

/**
 * An audit writer for one event (non-negotiable 7). Retention runs from the event date for the
 * bank's configured number of years; latency is measured from the writer's creation.
 */
export function makeAudit(
  deps: Pick<CheckDeps, "prisma">,
  bank: Bank,
  e: {
    id: string;
    trigger: string;
    customerRefHash: string;
    rulePackKey: string;
    locale: Locale;
    now: Date;
  },
): Audit {
  const started = performance.now();
  const base = {
    id: e.id,
    bankId: bank.id,
    occurredAt: e.now,
    trigger: e.trigger,
    customerRefHash: e.customerRefHash,
    rulePackKey: e.rulePackKey,
    locale: e.locale,
    retentionUntil: new Date(
      Date.UTC(
        e.now.getUTCFullYear() + bank.auditRetentionYears,
        e.now.getUTCMonth(),
        e.now.getUTCDate(),
      ),
    ),
  };
  return (fields) =>
    appendInsightEvent(deps.prisma, {
      ...base,
      ...fields,
      latencyMs: Math.round(performance.now() - started),
    });
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
  const audit = makeAudit(deps, bank, {
    id: insightId,
    trigger: `action:${req.action}`,
    customerRefHash,
    rulePackKey: req.action,
    locale,
    now,
  });

  // ── Consent first: without it, read no customer data and show generic information only ──
  const consent = await deps.prisma.consent.findFirst({
    where: { customerId: customer.id, purpose: "pre_decision_insights", withdrawnAt: null },
    select: { id: true },
  });
  if (!consent) return genericResponse(deps, bank, req, locale, insightId, audit);

  const context: PackContext = req.context;
  for (const key of PACK_REQUIRED_CONTEXT[req.action])
    if (context[key] === undefined) throw badRequest("missing_context");
  const bundle = await loadCustomerBundle(deps.prisma, customer.id, context.transactionId);
  const resolved = bundle ? resolvePackInput(req.action, bundle, context, now) : null;
  if (!resolved) throw notFound();

  const result = await deliverInsight(deps, bank, now, locale, insightId, audit, {
    packKey: req.action,
    variant: resolved.variant,
    input: resolved.input,
    context,
  });
  return result.response;
}

export interface Delivered {
  response: CheckResponse;
  /** Set when an insight card was shown (and audited). */
  evaluation: AnyEvaluation | null;
  auditEventId: string | null;
}

export type AuditFields = Parameters<Audit>[0];

/** The outcome of the pipeline before anything is audited. */
export type Prepared =
  | { shown: false; reason: string; evaluation: AnyEvaluation | null; auditFields: AuditFields }
  | {
      shown: true;
      evaluation: AnyEvaluation;
      card: InsightCard;
      wording: WordingResult;
      auditFields: AuditFields;
    };

/**
 * The shared pipeline for checks, scheduled alerts and Ask AMIL, up to (not including) the audit:
 *   rule-pack kill switch (9) -> evaluation (1) -> approved, enabled template (8, 9) ->
 *   gateway wording (2, 6) -> card.
 * Returns what to audit. `null` when a scheduled run's precheck says to stop silently.
 */
export async function prepareInsight(
  deps: CheckDeps,
  bank: Bank,
  now: Date,
  locale: Locale,
  subject: InsightSubject,
  precheck?: (evaluation: AnyEvaluation) => Promise<boolean>,
): Promise<Prepared | null> {
  const { packKey, variant } = subject;
  const pack = getPack(packKey, variant);

  // ── Kill switch and parameters (latest active version effective now) ──
  const packRow = await deps.prisma.rulePack.findFirst({
    where: {
      bankId: bank.id,
      key: packKey,
      variant,
      status: "active",
      effectiveFrom: { lte: now },
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  const suppressed = (
    reason: string,
    evaluation: AnyEvaluation | null = null,
    extra: Partial<AuditFields> = {},
  ): Prepared => {
    deps.log.info({ action: packKey, reason }, "insight_suppressed");
    return {
      shown: false,
      reason,
      evaluation,
      auditFields: {
        rulePackVersion: packRow?.version ?? "n/a",
        variant,
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
      },
    };
  };
  if (!packRow || !packRow.enabled) return suppressed("rule_pack_disabled");

  const params = pack.parametersSchema.safeParse({
    ...(pack.defaultParameters as object),
    ...(packRow.parameters as object),
  });
  if (!params.success) {
    deps.log.error({ action: packKey, version: packRow.version }, "rule_pack_parameters_invalid");
    return suppressed("rule_pack_parameters_invalid");
  }

  // ── Evaluate (pure) ──
  const evaluation: AnyEvaluation = pack.evaluate(
    subject.input as never,
    params.data,
    thresholdsFor(bank.severityThresholds, packKey),
    now,
  );
  if (precheck && !(await precheck(evaluation))) return null;
  const evaluated = {
    rulePackVersion: packRow.version,
    variant,
    inputSnapshotHash: sha256(canonicalJson(subject.input)),
    facts: stripSources(evaluation),
  };
  if (!evaluation.applicable)
    return suppressed("not_applicable", evaluation, {
      ...evaluated,
      severity: evaluation.severity,
    });

  // ── Approved, enabled template ──
  const templateKey = `${packKey}.${variant}.${evaluation.severity}`;
  const template = await findTemplate(deps, bank.id, templateKey, locale, variant);
  if (!template)
    return suppressed("template_unavailable", evaluation, {
      ...evaluated,
      severity: evaluation.severity,
    });

  // ── Wording ──
  let wording: WordingResult;
  try {
    wording = await deps.gateway.word({
      action: packKey,
      variant,
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
      return suppressed("template_render_failed", evaluation, {
        ...evaluated,
        severity: evaluation.severity,
      });
    throw error;
  }

  const card = buildCard(bank, packKey, subject.context, locale, evaluation, template, wording);
  const aiUsed = wording.source !== "template" && wording.provider !== "mock";
  return {
    shown: true,
    evaluation,
    card,
    wording,
    auditFields: {
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
    },
  };
}

/** prepareInsight + audit: what a check and a scheduled alert deliver. */
export async function deliverInsight(
  deps: CheckDeps,
  bank: Bank,
  now: Date,
  locale: Locale,
  insightId: string,
  audit: Audit,
  subject: InsightSubject,
  /**
   * Scheduled runs only: called after the pure evaluation. Returning false stops here without an
   * audit event (not applicable, or the customer was already alerted about this event).
   */
  precheck?: (evaluation: AnyEvaluation) => Promise<boolean>,
): Promise<Delivered> {
  const prepared = await prepareInsight(deps, bank, now, locale, subject, precheck);
  if (!prepared) return { response: none(insightId), evaluation: null, auditEventId: null };
  const row = await audit(prepared.auditFields);
  if (!prepared.shown) return { response: none(insightId), evaluation: null, auditEventId: null };
  const { evaluation, card } = prepared;
  return {
    response: {
      insightId,
      applicable: true,
      kind: "insight",
      severity: evaluation.severity,
      card,
      requiresAcknowledgement: evaluation.severity === "critical",
    },
    evaluation,
    auditEventId: row.id,
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

/** Approved (Islamic: Sharia-approved), enabled template, latest version (non-negotiables 8, 9). */
export async function findTemplate(
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
  packKey: PackKey,
  context: PackContext,
  locale: Locale,
  evaluation: AnyEvaluation,
  template: TemplateRow,
  wording: WordingResult,
): InsightCard {
  const display = { locale, digitStyle: bank.digitStyle };
  // Chips show only figures that appear in the approved copy as rendered for this customer.
  const referenced = [template.headline, template.body].flatMap((t) =>
    renderedFactKeys(t, evaluation.facts),
  );
  const facts: FactChip[] = [];
  for (const key of new Set(referenced)) {
    const raw = evaluation.facts[key];
    if (!raw || Array.isArray(raw)) continue;
    const fact = raw;
    if (!isTruthyFact(fact) || fact.unit === "boolean") continue;
    facts.push({
      key,
      label: factLabel(packKey, locale, key),
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
        { action: packKey, ...context },
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
    why: explain(packKey, locale, evaluation.explanation),
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
  audit: Audit,
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
