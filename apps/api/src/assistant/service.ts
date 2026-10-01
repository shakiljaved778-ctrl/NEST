import { randomUUID } from "node:crypto";
import {
  canonicalJson,
  DEMO_AMOUNTS,
  hashCustomerRef,
  loadCustomerBundle,
  type PackContext,
  resolvePackInput,
  sha256,
} from "@amil/db";
import { formatFact } from "@amil/gateway";
import { formatMoney } from "@amil/i18n";
import {
  factLabel,
  isTruthyFact,
  KNOWLEDGE,
  type PackKey,
  renderedFactKeys,
  renderTemplate,
} from "@amil/rule-packs";
import type { Fact, OptionKey, Variant } from "@amil/rules-engine";
import type {
  AssistantAnswer,
  AssistantMessageRequest,
  AssistantStreamEvent,
  CardOption,
  FactChip,
} from "@amil/sdk";
import { z } from "zod";
import { notFound } from "../errors";
import { explainCharge } from "../services/charges";
import {
  type AuditFields,
  type CheckDeps,
  findTemplate,
  type Locale,
  makeAudit,
  prepareInsight,
} from "../services/checks";
import { compareWithFacts } from "../services/compare";
import { deepLink, isOptionKey } from "../services/deeplinks";
import {
  type AssistantTools,
  buildAssistantGraph,
  type Draft,
  type PackOutcome,
  type Products,
} from "./graph";

export type Emit = (event: AssistantStreamEvent) => void;

const OptionsSchema = z.array(z.object({ key: z.string(), label: z.string() }));

/**
 * POST /v1/assistant/messages (Ask AMIL). Consent first (purpose "assistant"); then the LangGraph
 * graph runs over tools bound to this customer. Status events stream as each step completes; the
 * answer text streams only after it has passed the number validator and the guard, so nothing
 * unvalidated is ever shown. Each turn is one audit event (rulePackKey "assistant") holding the
 * question, the intent, the checks run and exactly what was shown.
 */
export async function runAssistant(
  deps: CheckDeps,
  bankId: string,
  req: AssistantMessageRequest,
  emit: Emit,
  sessionLocale?: Locale,
): Promise<AssistantAnswer> {
  const now = deps.clock();
  const bank = await deps.prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) throw notFound();
  const customer = await deps.prisma.customer.findUnique({
    where: { bankId_externalRef: { bankId, externalRef: req.customerRef } },
    select: { id: true, preferredLocale: true },
  });
  if (!customer) throw notFound();
  const locale: Locale = req.locale ?? sessionLocale ?? customer.preferredLocale;
  const conversationId = req.conversationId ?? randomUUID();
  const turnId = randomUUID();
  const audit = makeAudit(deps, bank, {
    id: turnId,
    trigger: "assistant",
    customerRefHash: hashCustomerRef(deps.auditHashSecret, bankId, req.customerRef),
    rulePackKey: "assistant",
    locale,
    now,
  });
  const display = { locale, digitStyle: bank.digitStyle };
  const format = (f: Fact) => formatFact(f, display);
  let variant: Variant = "conventional";

  // ── Tools bound to this customer ──
  const tools: AssistantTools = {
    async getProducts() {
      const c = await deps.prisma.customer.findUniqueOrThrow({
        where: { id: customer.id },
        include: {
          accounts: { where: { status: { not: "closed" } }, orderBy: { id: "asc" } },
          cards: {
            where: { status: "active" },
            include: { rewards: true },
            orderBy: { id: "asc" },
          },
          finances: { where: { status: "active" }, orderBy: { id: "asc" } },
          deposits: { where: { status: "active" }, orderBy: { id: "asc" } },
        },
      });
      const salary = c.accounts.find((a) => a.isSalaryAccount);
      variant = (salary ?? c.accounts[0])?.variant ?? "conventional";
      const products: Products = {
        variant,
        accounts: c.accounts.map((a) => ({
          id: a.id,
          name: a.productName,
          tags: [a.kind, ...(a.variant === "islamic" ? ["islamic"] : [])],
          balance: a.balance.toFixed(2),
        })),
        cards: c.cards.map((card) => ({
          id: card.id,
          name: card.productName,
          tags: [card.tier, ...(card.type === "islamic" ? ["islamic"] : [])],
          balance: card.balance.toFixed(2),
          hasRewards: Boolean(card.rewards && card.rewards.balance > 0),
        })),
        finances: c.finances.map((f) => ({
          id: f.id,
          name: f.productName,
          tags: [
            f.type === "conventional" ? "loan" : f.type,
            ...(f.type !== "conventional" ? ["islamic"] : []),
          ],
          outstanding: f.principalOutstanding.toFixed(2),
        })),
        deposits: c.deposits.map((d) => ({
          id: d.id,
          name: d.productName,
          tags: ["deposit", ...(d.variant === "islamic" ? ["islamic"] : [])],
          principal: d.principal.toFixed(2),
        })),
      };
      return products;
    },

    async evaluatePack(key, context) {
      const ctx: PackContext = { ...context };
      if (key === "card.epp_conversion" && ctx.cardId && !ctx.transactionId) {
        const purchase = await deps.prisma.transaction.findFirst({
          where: {
            cardId: ctx.cardId,
            type: "purchase",
            direction: "debit",
            amount: { gte: DEMO_AMOUNTS.eppMinPurchase },
          },
          orderBy: [{ amount: "desc" }, { id: "asc" }],
          select: { id: true },
        });
        if (!purchase) return { kind: "nothing" };
        ctx.transactionId = purchase.id;
        ctx.months ??= DEMO_AMOUNTS.eppMonths;
      }
      const bundle = await loadCustomerBundle(deps.prisma, customer.id, ctx.transactionId);
      const resolved = bundle ? resolvePackInput(key, bundle, ctx, now) : null;
      if (!resolved) return { kind: "unavailable" };
      const prepared = await prepareInsight(deps, bank, now, locale, {
        packKey: key,
        variant: resolved.variant,
        input: resolved.input,
        context: ctx,
      });
      if (!prepared) return { kind: "unavailable" };
      if (!prepared.shown)
        return prepared.reason === "not_applicable" ? { kind: "nothing" } : { kind: "unavailable" };
      const { card, evaluation, auditFields } = prepared;
      const outcome: PackOutcome = {
        kind: "insight",
        severity: evaluation.severity,
        headline: card.headline,
        body: card.body,
        facts: evaluation.facts,
        chips: card.facts,
        options: card.options,
        why: card.why,
        aiDisclosure: card.aiDisclosure,
        modelProvider: auditFields.modelProvider,
        modelVersion: auditFields.modelVersion,
        validatorResult: auditFields.validatorResult,
      };
      return outcome;
    },

    async compareScenario(scenario, params) {
      const r = await compareWithFacts(
        deps,
        bankId,
        { customerRef: req.customerRef, scenario, params, locale },
        locale,
      );
      return r.response.kind === "comparison" ? r : null;
    },

    async latestCharge() {
      const t = await deps.prisma.transaction.findFirst({
        where: {
          feeCode: { not: null },
          OR: [{ card: { customerId: customer.id } }, { account: { customerId: customer.id } }],
        },
        orderBy: [{ postedAt: "desc" }, { id: "asc" }],
        select: { id: true },
      });
      return t ? { transactionId: t.id } : null;
    },

    explainCharge: (transactionId) =>
      explainCharge(deps, bankId, { customerRef: req.customerRef, transactionId, locale }, locale),

    searchProductRules: (id) => KNOWLEDGE.find((e) => e.id === id && e.locale === locale) ?? null,

    async phrase(key, facts = { _sources: [] }, linkParams = {}) {
      const t = await findTemplate(deps, bankId, `${key}.${variant}.info`, locale, variant);
      if (!t) return null;
      const headline = renderTemplate(t.headline, facts, format);
      const body = renderTemplate(t.body, facts, format);
      if (headline.missing.length || body.missing.length) return null;
      const options: CardOption[] = OptionsSchema.parse(t.options)
        .filter((o): o is { key: OptionKey; label: string } => isOptionKey(o.key))
        .map((o) => ({
          key: o.key,
          label: o.label,
          deepLink: deepLink(
            bank.deepLinkScheme,
            o.key,
            { action: "assistant", ...linkParams },
            facts,
          ),
        }));
      const chips: FactChip[] = [
        ...new Set([t.headline, t.body].flatMap((x) => renderedFactKeys(x, facts))),
      ]
        .map((k) => facts[k])
        .filter(
          (f): f is Fact => !!f && !Array.isArray(f) && isTruthyFact(f) && f.unit !== "boolean",
        )
        .map((f) => ({
          key: f.key,
          label: factLabel("assistant", locale, f.key),
          value: f.value,
          display: format(f),
          unit: f.unit,
          source: f.source,
          asOf: f.asOf,
        }));
      return { key: t.key, headline: headline.text, body: body.text, options, facts, chips };
    },

    exampleAmounts(intent) {
      const values = {
        "card.cash_withdrawal": ["500.00", DEMO_AMOUNTS.cashWithdrawal, "2000.00"],
        "card.balance_transfer": ["2000.00", DEMO_AMOUNTS.balanceTransfer, "10000.00"],
        "finance.top_up": ["10000.00", DEMO_AMOUNTS.topUp, "50000.00"],
      }[intent];
      return values.map((value) => ({ value, label: formatMoney(value, display) }));
    },
  };

  // ── Consent first (purpose "assistant") ──
  const consent = await deps.prisma.consent.findFirst({
    where: { customerId: customer.id, purpose: "assistant", withdrawnAt: null },
    select: { id: true },
  });

  let answer: AssistantAnswer;
  let draft: Draft | null = null;
  let checks: string[] = [];
  let intent = "no_consent";
  if (!consent) {
    const p = await tools.phrase("assistant.no_consent");
    answer = {
      messageId: randomUUID(),
      conversationId,
      intent,
      kind: "no_consent",
      severity: null,
      headline: p?.headline ?? "",
      body: p?.body ?? "",
      details: [],
      why: [],
      facts: [],
      options: p?.options ?? [],
      suggestions: [],
      comparison: null,
      aiDisclosure: "",
    };
  } else {
    const graph = buildAssistantGraph(tools);
    let final: AssistantAnswer | null = null;
    const stream = await graph.stream(
      {
        input: {
          message: req.message,
          locale,
          conversationId,
          ...(req.context ? { context: req.context } : {}),
        },
      },
      { streamMode: "updates" },
    );
    for await (const update of stream) {
      for (const [step, value] of Object.entries(
        update as Record<string, Record<string, unknown>>,
      )) {
        emit({ event: "status", data: { step } });
        const v = value as {
          classified?: { intent: string };
          draft?: Draft;
          checks?: string[];
          answer?: AssistantAnswer;
        };
        if (v.classified) intent = v.classified.intent;
        if (v.draft) draft = v.draft;
        if (v.checks) checks = checks.concat(v.checks);
        if (v.answer) final = v.answer;
      }
    }
    if (!final) throw new Error("assistant graph produced no answer");
    answer = final;
  }

  // ── Stream the validated text, then the structured answer ──
  for (const chunk of chunks(`${answer.headline}\n\n${answer.body}`))
    emit({ event: "delta", data: { text: chunk } });
  emit({ event: "answer", data: answer });

  const rejected = checks.some(
    (c) => c.startsWith("numbers_rejected") || c.startsWith("guard_blocked"),
  );
  const fields: AuditFields = {
    rulePackVersion: "assistant@1",
    variant,
    inputSnapshotHash: sha256(canonicalJson({ intent, context: req.context ?? null })),
    applicable: true,
    severity: answer.severity,
    facts: draft ? { ...draft.facts } : {},
    templateKey: draft?.templateKey ?? (consent ? null : "assistant.no_consent"),
    templateVersion: null,
    modelProvider: draft?.model.provider ?? null,
    modelVersion: draft?.model.version ?? null,
    validatorResult: rejected ? "rejected" : (draft?.model.validatorResult ?? "not_used"),
    shown: { conversationId, question: req.message, intent, checks, answer },
  };
  await audit(fields);
  emit({ event: "done", data: {} });
  return answer;
}

/** Split text into small word groups for streaming (the text is already validated). */
function chunks(text: string): string[] {
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += 8) out.push(words.slice(i, i + 8).join(""));
  return out.filter(Boolean);
}

export type { PackKey };
