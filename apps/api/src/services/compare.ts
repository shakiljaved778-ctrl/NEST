import { randomUUID } from "node:crypto";
import { hashCustomerRef, loadCustomerBundle, type PackContext, resolvePackInput } from "@amil/db";
import { formatFact } from "@amil/gateway";
import { messages } from "@amil/i18n";
import {
  type Comparison,
  compareDepositBreakVsWait,
  compareMinVsCustomPayment,
  compareSettlementTiming,
  factLabel,
  getPack,
  type PackKey,
  optionTitle,
  renderTemplate,
} from "@amil/rule-packs";
import type { AnyFactSet, Fact, OptionKey } from "@amil/rules-engine";
import type { CardOption, CompareRequest, CompareResponse, FactChip } from "@amil/sdk";
import { z } from "zod";
import { badRequest, notFound } from "../errors";
import { type Bank, type CheckDeps, findTemplate, type Locale, makeAudit } from "./checks";
import { deepLink, isOptionKey } from "./deeplinks";

const SCENARIO_PACK: Record<
  CompareRequest["scenario"],
  { pack: PackKey; needs: "financeId" | "cardId" | "depositId" }
> = {
  settlement_timing: { pack: "finance.early_settlement", needs: "financeId" },
  min_vs_custom_payment: { pack: "card.minimum_payment", needs: "cardId" },
  deposit_break_vs_wait: { pack: "deposit.break", needs: "depositId" },
};

const OptionsSchema = z.array(z.object({ key: z.string(), label: z.string() }));

/**
 * POST /v1/compare: the customer's own options side by side (section 7). Same gates as a check:
 * consent first, the underlying pack's kill switch and stored parameters, approved copy. The
 * figures are the engine's (rule-packs `compare*`); the copy is the bank's approved summary, with
 * no model involved. Audited as `compare.<scenario>`.
 */
export async function runCompare(
  deps: CheckDeps,
  bankId: string,
  req: CompareRequest,
  sessionLocale?: Locale,
): Promise<CompareResponse> {
  return (await compareWithFacts(deps, bankId, req, sessionLocale)).response;
}

/** runCompare, also returning the summary facts the copy was rendered from (Ask AMIL validates them). */
export async function compareWithFacts(
  deps: CheckDeps,
  bankId: string,
  req: CompareRequest,
  sessionLocale?: Locale,
): Promise<{ response: CompareResponse; facts: AnyFactSet }> {
  const now = deps.clock();
  const bank = await deps.prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) throw notFound();
  const customer = await deps.prisma.customer.findUnique({
    where: { bankId_externalRef: { bankId, externalRef: req.customerRef } },
    select: { id: true, preferredLocale: true },
  });
  if (!customer) throw notFound();
  const locale: Locale = req.locale ?? sessionLocale ?? customer.preferredLocale;
  const { pack, needs } = SCENARIO_PACK[req.scenario];
  if (!req.params[needs]) throw badRequest("missing_context");

  const compareId = randomUUID();
  const audit = makeAudit(deps, bank, {
    id: compareId,
    trigger: `action:compare.${req.scenario}`,
    customerRefHash: hashCustomerRef(deps.auditHashSecret, bankId, req.customerRef),
    rulePackKey: `compare.${req.scenario}`,
    locale,
    now,
  });
  const empty = (kind: "generic" | "none", disclosure: string): CompareResponse => ({
    compareId,
    scenario: req.scenario,
    kind,
    headline: null,
    body: null,
    options: [],
    actions: [],
    disclosure,
  });
  const record = async (
    res: CompareResponse,
    f: {
      version: string;
      variant: "conventional" | "islamic";
      applicable: boolean;
      facts?: object;
      summary?: AnyFactSet;
    },
  ) => {
    await audit({
      rulePackVersion: f.version,
      variant: f.variant,
      inputSnapshotHash: "",
      applicable: f.applicable,
      severity: f.applicable ? "info" : null,
      facts: f.facts ?? {},
      templateKey: f.applicable ? `compare.${req.scenario}.${f.variant}.info` : null,
      templateVersion: null,
      modelProvider: null,
      modelVersion: null,
      validatorResult: "not_used",
      shown: res,
    });
    return { response: res, facts: f.summary ?? { _sources: [] } };
  };

  const consent = await deps.prisma.consent.findFirst({
    where: { customerId: customer.id, purpose: "pre_decision_insights", withdrawnAt: null },
    select: { id: true },
  });
  if (!consent)
    return record(empty("generic", messages[locale].insight.genericFooter), {
      version: "n/a",
      variant: "conventional",
      applicable: false,
    });

  const context: PackContext = {
    ...(req.params.financeId ? { financeId: req.params.financeId } : {}),
    ...(req.params.cardId ? { cardId: req.params.cardId } : {}),
    ...(req.params.depositId ? { depositId: req.params.depositId } : {}),
    ...(req.params.paymentAmount ? { paymentAmount: req.params.paymentAmount } : {}),
  };
  const bundle = await loadCustomerBundle(deps.prisma, customer.id);
  const resolved = bundle ? resolvePackInput(pack, bundle, context, now) : null;
  if (!resolved) throw notFound();
  const { variant } = resolved;

  const params = await packParameters(deps, bank, pack, variant, now);
  if (!params) return record(empty("none", ""), { version: "n/a", variant, applicable: false });
  const comparison = compute(req.scenario, resolved.input, params.parameters, now);
  const template = await findTemplate(
    deps,
    bank.id,
    `compare.${req.scenario}.${variant}.info`,
    locale,
    variant,
  );
  if (!comparison.applicable || !template)
    return record(empty("none", ""), { version: params.version, variant, applicable: false });

  const display = { locale, digitStyle: bank.digitStyle };
  const format = (f: Fact) => formatFact(f, display);
  const headline = renderTemplate(template.headline, comparison.summary, format);
  const body = renderTemplate(template.body, comparison.summary, format);
  if (headline.missing.length || body.missing.length)
    return record(empty("none", ""), { version: params.version, variant, applicable: false });

  const labels = new Map(OptionsSchema.parse(template.options).map((o) => [o.key, o.label]));
  const link = (key: OptionKey, facts: AnyFactSet): CardOption | null => {
    const label = labels.get(key);
    return label
      ? {
          key,
          label,
          deepLink: deepLink(bank.deepLinkScheme, key, { action: pack, ...context }, facts),
        }
      : null;
  };
  const options = comparison.options.map((o) => {
    const merged = { ...comparison.summary, ...o.facts } as AnyFactSet;
    return {
      key: o.key,
      title: optionTitle(locale, o.key),
      best: o.best,
      facts: chips(req.scenario, o.facts, locale, format),
      action: o.action ? link(o.action, merged) : null,
    };
  });
  const used = new Set(comparison.options.map((o) => o.action).filter((a): a is OptionKey => !!a));
  const actions = [...labels.keys()]
    .filter((k): k is OptionKey => isOptionKey(k) && (used.has(k) || k === "talk_to_someone"))
    .map((k) => link(k, comparison.summary as AnyFactSet))
    .filter((o): o is CardOption => o !== null);

  const res: CompareResponse = {
    compareId,
    scenario: req.scenario,
    kind: "comparison",
    headline: headline.text,
    body: body.text,
    options,
    actions,
    disclosure: messages[locale].insight.footerFigures
      .replace("{bankName}", locale === "ar" ? bank.nameAr : bank.name)
      .replace(
        "{asOf}",
        formatFact(
          { key: "asOf", value: firstAsOf(comparison), unit: "date", source: "computed", asOf: "" },
          display,
        ),
      ),
  };
  return record(res, {
    version: params.version,
    variant,
    applicable: true,
    facts: { summary: comparison.summary, options: comparison.options },
    summary: comparison.summary,
  });
}

function compute(
  scenario: CompareRequest["scenario"],
  input: unknown,
  params: unknown,
  now: Date,
): Comparison {
  switch (scenario) {
    case "settlement_timing":
      return compareSettlementTiming(input as never, params as never, now);
    case "min_vs_custom_payment":
      return compareMinVsCustomPayment(input as never, params as never);
    case "deposit_break_vs_wait":
      return compareDepositBreakVsWait(input as never, params as never, now);
  }
}

function chips(
  scenario: string,
  facts: AnyFactSet,
  locale: Locale,
  format: (f: Fact) => string,
): FactChip[] {
  return Object.entries(facts)
    .filter((e): e is [string, Fact] => e[0] !== "_sources" && !Array.isArray(e[1]))
    .filter(([, f]) => f.unit !== "boolean")
    .map(([key, f]) => ({
      key,
      label: factLabel(`compare.${scenario}`, locale, key),
      value: f.value,
      display: format(f),
      unit: f.unit,
      source: f.source,
      asOf: f.asOf,
    }));
}

function firstAsOf(c: Comparison): string {
  return (
    c.summary._sources
      .map((s) => s.asOf)
      .sort()
      .at(-1) ?? ""
  );
}

/**
 * The pack's kill switch and stored parameters (latest active version effective now), validated
 * against the pack's schema. `null` when the pack is disabled or its parameters are invalid.
 */
export async function packParameters(
  deps: CheckDeps,
  bank: Bank,
  key: PackKey,
  variant: "conventional" | "islamic",
  now: Date,
): Promise<{ version: string; parameters: unknown } | null> {
  const row = await deps.prisma.rulePack.findFirst({
    where: { bankId: bank.id, key, variant, status: "active", effectiveFrom: { lte: now } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  if (!row || !row.enabled) return null;
  const pack = getPack(key, variant);
  const params = pack.parametersSchema.safeParse({
    ...(pack.defaultParameters as object),
    ...(row.parameters as object),
  });
  return params.success ? { version: row.version, parameters: params.data } : null;
}
