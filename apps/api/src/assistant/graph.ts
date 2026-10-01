import { randomUUID } from "node:crypto";
import { validateNumbers } from "@amil/gateway";
import { type KnowledgeEntry, type PackKey, copyViolations, suggestion } from "@amil/rule-packs";
import type { AnyFactSet, Fact, Variant } from "@amil/rules-engine";
import type {
  AssistantAnswer,
  AssistantContext,
  AssistantSuggestion,
  CardOption,
  ChargeExplanation,
  CompareResponse,
  CompareScenario,
  FactChip,
  Severity,
} from "@amil/sdk";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  ACTION_INTENTS,
  type Classified,
  classify,
  type Intent,
  type PackIntent,
} from "./classify";

type Locale = "en" | "ar";

// ── Tools (implemented by the API over the bank's records; the graph never touches I/O) ──────

export interface ProductRef {
  id: string;
  name: string;
  /** Words that identify it in a question: tier, finance type, account kind, "islamic". */
  tags: string[];
}
export interface Products {
  variant: Variant;
  accounts: (ProductRef & { balance: string })[];
  cards: (ProductRef & { balance: string; hasRewards: boolean })[];
  finances: (ProductRef & { outstanding: string })[];
  deposits: (ProductRef & { principal: string })[];
}

/** An approved Ask AMIL phrase, rendered from facts (null when disabled or not approved). */
export interface Phrase {
  key: string;
  headline: string;
  body: string;
  options: CardOption[];
  facts: AnyFactSet;
  chips: FactChip[];
}

/** Outcome of evaluating a pack for the assistant (no audit: the turn is audited once). */
export type PackOutcome =
  | {
      kind: "insight";
      severity: Severity;
      headline: string;
      body: string;
      facts: AnyFactSet;
      chips: FactChip[];
      options: CardOption[];
      why: string[];
      aiDisclosure: string;
      modelProvider: string | null;
      modelVersion: string | null;
      validatorResult: "passed" | "rejected" | "not_used";
    }
  | { kind: "nothing" }
  | { kind: "unavailable" };

export interface AssistantTools {
  getProducts(): Promise<Products>;
  evaluatePack(key: PackKey, context: AssistantContext): Promise<PackOutcome>;
  compareScenario(
    scenario: CompareScenario,
    params: { financeId?: string; cardId?: string; depositId?: string },
  ): Promise<{ response: CompareResponse; facts: AnyFactSet } | null>;
  latestCharge(): Promise<{ transactionId: string } | null>;
  explainCharge(transactionId: string): Promise<ChargeExplanation>;
  searchProductRules(id: string): KnowledgeEntry | null;
  phrase(
    key: string,
    facts?: AnyFactSet,
    linkParams?: Record<string, string>,
  ): Promise<Phrase | null>;
  /** Example amounts offered when an amount is needed (formatted label + decimal value). */
  exampleAmounts(
    intent: "card.cash_withdrawal" | "card.balance_transfer" | "finance.top_up",
  ): { label: string; value: string }[];
}

// ── State ────────────────────────────────────────────────────────────────────────────────────

export interface AssistantInput {
  message: string;
  locale: Locale;
  context?: AssistantContext;
  conversationId: string;
}

/** What `compute` produced, before copy is chosen. */
type Computed =
  | { kind: "pack"; intent: PackIntent; outcome: PackOutcome; context: AssistantContext }
  | { kind: "comparison"; response: CompareResponse; facts: AnyFactSet }
  | { kind: "charge"; explanation: ChargeExplanation; transactionId: string }
  | { kind: "no_charges" }
  | { kind: "products"; products: Products }
  | { kind: "faq"; entry: KnowledgeEntry }
  | { kind: "clarify"; choices: AssistantSuggestion[] }
  | { kind: "ask_amount"; choices: AssistantSuggestion[] }
  | { kind: "no_product" }
  | { kind: "phrase"; key: "help" | "unknown" | "refuse_advice" | "refuse_scope" | "unavailable" };

export interface Draft {
  kind: AssistantAnswer["kind"];
  severity: Severity | null;
  headline: string;
  body: string;
  details: string[];
  why: string[];
  facts: AnyFactSet;
  chips: FactChip[];
  options: CardOption[];
  suggestions: AssistantSuggestion[];
  comparison: CompareResponse | null;
  aiDisclosure: string | null;
  templateKey: string | null;
  model: {
    provider: string | null;
    version: string | null;
    validatorResult: "passed" | "rejected" | "not_used";
  };
}

const State = Annotation.Root({
  input: Annotation<AssistantInput>(),
  classified: Annotation<Classified>(),
  products: Annotation<Products | null>({ reducer: (_a, b) => b, default: () => null }),
  computed: Annotation<Computed>(),
  draft: Annotation<Draft>(),
  checks: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  answer: Annotation<AssistantAnswer>(),
});
type S = typeof State.State;

const NEEDS_PRODUCTS = new Set<Intent>([
  ...ACTION_INTENTS,
  "compare.settlement_timing",
  "compare.min_vs_custom_payment",
  "compare.deposit_break_vs_wait",
  "products",
]);

const ADVICE = {
  en: /\b(you should (buy|invest|open|apply|take)|i (would )?recommend|we recommend|best (product|card|deal|offer)|consider (buying|investing))\b/i,
  ar: /أنصحك|انصحك|ننصحك|نوصي|أوصي|يفضل أن تشتري|الأفضل لك أن/,
};

/**
 * Ask AMIL (section 9), a LangGraph graph:
 *   classify_intent → fetch_customer_context → compute → draft_answer → validate_numbers →
 *   guard → respond.
 * Figures come only from tools that call the rules engine; wording of computed answers goes
 * through the model gateway (redacted facts, number validator, approved template fallback).
 */
export function buildAssistantGraph(tools: AssistantTools) {
  return new StateGraph(State)
    .addNode("classify_intent", (s: S) => ({ classified: classifyTurn(s.input) }))
    .addNode("fetch_customer_context", async () => ({ products: await tools.getProducts() }))
    .addNode("compute", async (s: S) => ({ computed: await compute(tools, s) }))
    .addNode("draft_answer", async (s: S) => ({ draft: await draft(tools, s) }))
    .addNode("validate_numbers", async (s: S) => validate(tools, s))
    .addNode("guard", async (s: S) => guard(tools, s))
    .addNode("respond", (s: S) => ({ answer: respond(s) }))
    .addEdge(START, "classify_intent")
    .addConditionalEdges(
      "classify_intent",
      (s: S) => (NEEDS_PRODUCTS.has(s.classified.intent) ? "fetch_customer_context" : "compute"),
      ["fetch_customer_context", "compute"],
    )
    .addEdge("fetch_customer_context", "compute")
    .addEdge("compute", "draft_answer")
    .addEdge("draft_answer", "validate_numbers")
    .addEdge("validate_numbers", "guard")
    .addEdge("guard", "respond")
    .addEdge("respond", END)
    .compile();
}

export const GRAPH_STEPS = [
  "classify_intent",
  "fetch_customer_context",
  "compute",
  "draft_answer",
  "validate_numbers",
  "guard",
  "respond",
] as const;

// ── classify_intent ──────────────────────────────────────────────────────────────────────────

function classifyTurn(input: AssistantInput): Classified {
  const topic = input.context?.topic;
  const base = classify(input.message, input.locale);
  // A tapped suggestion carries its topic: trust it over the free text.
  if (topic && isIntent(topic)) return { ...base, intent: topic };
  return base;
}

const ALL_INTENTS: readonly string[] = [
  ...ACTION_INTENTS,
  "compare.settlement_timing",
  "compare.min_vs_custom_payment",
  "compare.deposit_break_vs_wait",
  "explain.charge",
  "products",
  "help",
];
const isIntent = (t: string): t is Intent => ALL_INTENTS.includes(t);

// ── compute (tools only) ─────────────────────────────────────────────────────────────────────

type Kind = "cards" | "finances" | "deposits" | "accounts";
const SUBJECT: Partial<
  Record<Intent, { kind: Kind; key: "cardId" | "financeId" | "depositId" | "accountId" }>
> = {
  "card.close": { kind: "cards", key: "cardId" },
  "card.cash_withdrawal": { kind: "cards", key: "cardId" },
  "card.minimum_payment": { kind: "cards", key: "cardId" },
  "card.epp_conversion": { kind: "cards", key: "cardId" },
  "card.balance_transfer": { kind: "cards", key: "cardId" },
  "rewards.expiry": { kind: "cards", key: "cardId" },
  "finance.early_settlement": { kind: "finances", key: "financeId" },
  "finance.top_up": { kind: "finances", key: "financeId" },
  "deposit.break": { kind: "deposits", key: "depositId" },
  "account.close": { kind: "accounts", key: "accountId" },
  "compare.settlement_timing": { kind: "finances", key: "financeId" },
  "compare.min_vs_custom_payment": { kind: "cards", key: "cardId" },
  "compare.deposit_break_vs_wait": { kind: "deposits", key: "depositId" },
};
const NEEDS_AMOUNT = new Set<Intent>([
  "card.cash_withdrawal",
  "card.balance_transfer",
  "finance.top_up",
]);

async function compute(tools: AssistantTools, s: S): Promise<Computed> {
  const { intent, amount, months, hints } = s.classified;
  const { input } = s;
  switch (intent) {
    case "help":
    case "unknown":
    case "refuse_advice":
    case "refuse_scope":
      return { kind: "phrase", key: intent };
    case "faq": {
      const entry = s.classified.faqId ? tools.searchProductRules(s.classified.faqId) : null;
      return entry ? { kind: "faq", entry } : { kind: "phrase", key: "unknown" };
    }
    case "explain.charge": {
      const latest = await tools.latestCharge();
      if (!latest) return { kind: "no_charges" };
      return {
        kind: "charge",
        explanation: await tools.explainCharge(latest.transactionId),
        transactionId: latest.transactionId,
      };
    }
    case "products":
      return { kind: "products", products: s.products as Products };
    case "salary.transfer_change":
      return { kind: "pack", intent, outcome: await tools.evaluatePack(intent, {}), context: {} };
    case "account.dormancy": {
      // Proactive pack asked about directly: check every account, report the first that applies.
      for (const a of (s.products as Products).accounts) {
        const outcome = await tools.evaluatePack(intent, { accountId: a.id });
        if (outcome.kind !== "nothing")
          return { kind: "pack", intent, outcome, context: { accountId: a.id } };
      }
      return { kind: "pack", intent, outcome: { kind: "nothing" }, context: {} };
    }
    default:
      break;
  }

  const subject = SUBJECT[intent];
  if (!subject) return { kind: "phrase", key: "unknown" };
  const products = s.products as Products;
  let candidates: ProductRef[] = products[subject.kind];
  if (intent === "rewards.expiry") candidates = products.cards.filter((c) => c.hasRewards);
  const chosenId = input.context?.[subject.key];
  const chosen = chosenId ? candidates.filter((c) => c.id === chosenId) : narrow(candidates, hints);
  if (chosen.length === 0) return { kind: "no_product" };
  if (chosen.length > 1)
    return {
      kind: "clarify",
      choices: chosen.map((c) => ({
        label: c.name,
        message: input.message,
        context: { ...input.context, topic: intent, [subject.key]: c.id },
      })),
    };
  const product = chosen[0] as ProductRef;
  const context: AssistantContext = { ...input.context, [subject.key]: product.id };
  delete context.topic;

  const givenAmount = input.context?.amount ?? amount;
  if (NEEDS_AMOUNT.has(intent) && !givenAmount)
    return {
      kind: "ask_amount",
      choices: tools.exampleAmounts(intent as "card.cash_withdrawal").map((a) => ({
        label: a.label,
        message: input.message,
        context: { ...context, topic: intent, amount: a.value },
      })),
    };
  if (givenAmount) context.amount = givenAmount;
  if (intent === "finance.top_up") context.months = input.context?.months ?? months ?? 60;

  if (intent.startsWith("compare.")) {
    const scenario = intent.slice("compare.".length) as CompareScenario;
    const result = await tools.compareScenario(scenario, { [subject.key]: product.id });
    return result ? { kind: "comparison", ...result } : { kind: "phrase", key: "unavailable" };
  }
  return {
    kind: "pack",
    intent: intent as PackIntent,
    outcome: await tools.evaluatePack(intent as PackKey, context),
    context,
  };
}

/** Products the question names (by tag); all of them when it names none. */
function narrow(candidates: ProductRef[], hints: string[]): ProductRef[] {
  if (!hints.length) return candidates;
  const named = candidates.filter((c) => hints.some((h) => c.tags.includes(h)));
  return named.length ? named : candidates;
}

// ── draft_answer ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FACTS: AnyFactSet = { _sources: [] };
const NO_MODEL = { provider: null, version: null, validatorResult: "not_used" as const };

async function phraseDraft(
  tools: AssistantTools,
  key: string,
  kind: Draft["kind"],
  extra: Partial<Draft> = {},
  facts?: AnyFactSet,
  linkParams?: Record<string, string>,
): Promise<Draft> {
  const p =
    (await tools.phrase(`assistant.${key}`, facts, linkParams)) ??
    (await tools.phrase("assistant.unavailable"));
  return {
    kind,
    severity: null,
    headline: p?.headline ?? "",
    body: p?.body ?? "",
    details: [],
    why: [],
    facts: p?.facts ?? EMPTY_FACTS,
    chips: p?.chips ?? [],
    options: p?.options ?? [],
    suggestions: [],
    comparison: null,
    aiDisclosure: null,
    templateKey: p?.key ?? null,
    model: NO_MODEL,
    ...extra,
  };
}

function fact(key: string, value: string, unit: Fact["unit"], asOf: string): Fact {
  return { key, value, unit, source: "computed", asOf };
}

async function draft(tools: AssistantTools, s: S): Promise<Draft> {
  const c = s.computed;
  switch (c.kind) {
    case "phrase": {
      const kind =
        c.key === "help"
          ? "help"
          : c.key === "unknown"
            ? "unknown"
            : c.key === "unavailable"
              ? "nothing"
              : "refusal";
      return phraseDraft(tools, c.key, kind);
    }
    case "faq":
      return {
        ...(await phraseDraft(tools, "faq", "faq")),
        headline: c.entry.title,
        body: c.entry.paragraphs[0] ?? "",
        details: c.entry.paragraphs.slice(1),
        templateKey: `knowledge.${c.entry.locale}.${c.entry.id}`,
      };
    case "no_charges":
      return phraseDraft(tools, "no_charges", "nothing");
    case "no_product":
      return phraseDraft(tools, "no_product", "nothing");
    case "clarify":
      return phraseDraft(tools, "clarify", "clarify", { suggestions: c.choices });
    case "ask_amount":
      return phraseDraft(tools, "ask_amount", "clarify", { suggestions: c.choices });
    case "products": {
      const p = c.products;
      const asOf = new Date().toISOString().slice(0, 10);
      const facts: AnyFactSet = {
        _sources: [{ source: "computed", asOf }],
        accountsCount: fact("accountsCount", String(p.accounts.length), "count", asOf),
        cardsCount: fact("cardsCount", String(p.cards.length), "count", asOf),
        financesCount: fact("financesCount", String(p.finances.length), "count", asOf),
        depositsCount: fact("depositsCount", String(p.deposits.length), "count", asOf),
      };
      const d = await phraseDraft(tools, "products", "products", {}, facts);
      return { ...d, chips: [] };
    }
    case "charge": {
      const x = c.explanation;
      if (x.kind !== "charge" || !x.amount || !x.postedAt)
        return phraseDraft(tools, "unavailable", "nothing");
      const facts: AnyFactSet = {
        _sources: [{ source: "transaction", asOf: x.postedAt }],
        chargeAmount: {
          key: "chargeAmount",
          value: x.amount.value,
          unit: "QAR",
          source: "transaction",
          asOf: x.postedAt,
        },
        chargeDate: {
          key: "chargeDate",
          value: x.postedAt,
          unit: "date",
          source: "transaction",
          asOf: x.postedAt,
        },
        chargeMatches: {
          key: "chargeMatches",
          value: String(x.calculation?.matches === true),
          unit: "boolean",
          source: "fee_schedule",
          asOf: x.postedAt,
        },
      };
      const d = await phraseDraft(tools, "charge", "charge", {}, facts, {
        transactionId: c.transactionId,
      });
      return {
        ...d,
        details: [x.name, x.description].filter((t): t is string => !!t),
        aiDisclosure: x.disclosure,
      };
    }
    case "comparison":
      return {
        kind: "comparison",
        severity: null,
        headline: c.response.headline ?? "",
        body: c.response.body ?? "",
        details: [],
        why: [],
        facts: c.facts,
        chips: [],
        options: c.response.actions,
        suggestions: [],
        comparison: c.response,
        aiDisclosure: c.response.disclosure,
        templateKey: `compare.${c.response.scenario}`,
        model: NO_MODEL,
      };
    case "pack": {
      const o = c.outcome;
      if (o.kind === "nothing") return phraseDraft(tools, "nothing", "nothing");
      if (o.kind === "unavailable") return phraseDraft(tools, "unavailable", "nothing");
      return {
        kind: "insight",
        severity: o.severity,
        headline: o.headline,
        body: o.body,
        details: [],
        why: o.why,
        facts: o.facts,
        chips: o.chips,
        options: o.options,
        suggestions: [],
        comparison: null,
        aiDisclosure: o.aiDisclosure,
        templateKey: c.intent,
        model: {
          provider: o.modelProvider,
          version: o.modelVersion,
          validatorResult: o.validatorResult,
        },
      };
    }
  }
}

// ── validate_numbers ─────────────────────────────────────────────────────────────────────────

/**
 * Defence in depth (non-negotiable 2): every number and date in the answer's headline and body
 * must be one of its facts. Details are the bank's own approved text (FAQ, fee schedule) and never
 * pass through a model. A failure replaces the answer with the approved "unavailable" phrase.
 */
async function validate(tools: AssistantTools, s: S): Promise<Partial<S>> {
  const d = s.draft;
  const result = validateNumbers(`${d.headline}\n${d.body}`, d.facts);
  if (result.ok) return { checks: ["numbers_ok"] };
  return {
    checks: [`numbers_rejected:${result.offending.join(",")}`],
    draft: await phraseDraft(tools, "unavailable", "nothing"),
  };
}

// ── guard ────────────────────────────────────────────────────────────────────────────────────

/** No advice to buy, no selling, Sharia terminology, nothing out of scope reaches the customer. */
async function guard(tools: AssistantTools, s: S): Promise<Partial<S>> {
  const { locale } = s.input;
  const variant = s.products?.variant ?? "conventional";
  const text = [s.draft.headline, s.draft.body, ...s.draft.details].join("\n");
  const violations = copyViolations(text, locale, variant);
  if (ADVICE[locale].test(text)) violations.push("advice");
  if (!violations.length) return { checks: ["guard_ok"] };
  return {
    checks: [`guard_blocked:${violations.join(",")}`],
    draft: await phraseDraft(tools, "refuse_advice", "refusal"),
  };
}

// ── respond ──────────────────────────────────────────────────────────────────────────────────

const DEFAULT_TOPICS = [
  "card.close",
  "explain.charge",
  "finance.early_settlement",
  "deposit.break",
  "products",
];

function respond(s: S): AssistantAnswer {
  const d = s.draft;
  const { locale } = s.input;
  const current = s.classified.intent;
  const suggestions = d.suggestions.length
    ? d.suggestions
    : DEFAULT_TOPICS.filter((t) => t !== current)
        .slice(0, 3)
        .map((topic) => ({
          label: suggestion(locale, topic) ?? topic,
          message: suggestion(locale, topic) ?? topic,
          context: { topic },
        }));
  return {
    messageId: randomUUID(),
    conversationId: s.input.conversationId,
    intent: current,
    kind: d.kind,
    severity: d.severity,
    headline: d.headline,
    body: d.body,
    details: d.details,
    why: d.why,
    facts: d.chips,
    options: d.options,
    suggestions,
    comparison: d.comparison,
    aiDisclosure: d.aiDisclosure ?? "",
  };
}
