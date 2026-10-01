/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await -- spies and async fakes in tests */
import type { AnyFactSet, Fact } from "@amil/rules-engine";
import { describe, expect, it, vi } from "vitest";
import {
  type AssistantInput,
  type AssistantTools,
  buildAssistantGraph,
  GRAPH_STEPS,
  type PackOutcome,
  type Products,
} from "./graph";

const asOf = "2026-09-30";
const f = (key: string, value: string, unit: Fact["unit"]): Fact => ({
  key,
  value,
  unit,
  source: "computed",
  asOf,
});
const facts = (...list: Fact[]): AnyFactSet => ({
  _sources: [{ source: "computed", asOf }],
  ...Object.fromEntries(list.map((x) => [x.key, x])),
});

const PRODUCTS: Products = {
  variant: "conventional",
  accounts: [{ id: "acc_1", name: "Current Account", tags: ["current"], balance: "100.00" }],
  cards: [
    { id: "card_p", name: "Platinum Card", tags: ["platinum"], balance: "10.00", hasRewards: true },
    { id: "card_g", name: "Gold Card", tags: ["gold"], balance: "20.00", hasRewards: false },
  ],
  finances: [],
  deposits: [],
};

const insight = (
  body: string,
  extra: Partial<Extract<PackOutcome, { kind: "insight" }>> = {},
): PackOutcome => ({
  kind: "insight",
  severity: "critical",
  headline: "Closing this card forfeits QAR 420.00",
  body,
  facts: facts(f("pointsValue", "420.00", "QAR")),
  chips: [],
  options: [
    { key: "redeem_points", label: "Redeem points first", deepLink: "ddb://cards/card_p/rewards" },
  ],
  why: ["Your card has reward points."],
  aiDisclosure: "Figures from Doha Demo Bank records as of 30 Sep 2026.",
  modelProvider: null,
  modelVersion: null,
  validatorResult: "passed",
  ...extra,
});

function fakeTools(overrides: Partial<AssistantTools> = {}): AssistantTools {
  return {
    getProducts: vi.fn(async () => PRODUCTS),
    evaluatePack: vi.fn(async () =>
      insight("Your points, worth QAR 420.00, end when the card closes."),
    ),
    compareScenario: vi.fn(async () => null),
    latestCharge: vi.fn(async () => null),
    explainCharge: vi.fn(),
    searchProductRules: vi.fn(() => null),
    phrase: vi.fn(async (key: string) => ({
      key,
      headline: `phrase:${key}`,
      body: "",
      options: [
        {
          key: "talk_to_someone" as const,
          label: "Talk to someone",
          deepLink: "ddb://support/callback",
        },
      ],
      facts: { _sources: [] },
      chips: [],
    })),
    exampleAmounts: vi.fn(() => [{ label: "QAR 1,000.00", value: "1000.00" }]),
    ...overrides,
  };
}

const input = (message: string, extra: Partial<AssistantInput> = {}): AssistantInput => ({
  message,
  locale: "en",
  conversationId: "c0a8f5b2-0000-4000-8000-000000000000",
  ...extra,
});

async function run(tools: AssistantTools, i: AssistantInput) {
  const steps: string[] = [];
  let state: Record<string, unknown> = {};
  const checks: string[] = [];
  for await (const u of await buildAssistantGraph(tools).stream(
    { input: i },
    { streamMode: "updates" },
  )) {
    for (const [k, v] of Object.entries(u as Record<string, Record<string, unknown>>)) {
      steps.push(k);
      if (Array.isArray(v.checks)) checks.push(...(v.checks as string[]));
      state = { ...state, ...v };
    }
  }
  return {
    steps,
    answer: state.answer as Record<string, unknown>,
    checks,
  };
}

describe("Ask AMIL graph", () => {
  it("runs every step in order for a product question and uses the rules-engine tool", async () => {
    const tools = fakeTools();
    const { steps, answer } = await run(tools, input("What happens if I close my platinum card?"));
    expect(steps).toEqual([...GRAPH_STEPS]);
    expect(tools.evaluatePack).toHaveBeenCalledWith("card.close", { cardId: "card_p" });
    expect(answer).toMatchObject({ kind: "insight", severity: "critical", intent: "card.close" });
    expect(answer.why).toEqual(["Your card has reward points."]);
    expect(answer.details).toEqual([]);
  });

  it("asks which card when the question fits more than one; a tapped choice carries the product", async () => {
    const tools = fakeTools();
    const first = await run(tools, input("close my card"));
    expect(first.answer.kind).toBe("clarify");
    const choices = first.answer.suggestions as {
      label: string;
      context: Record<string, string>;
    }[];
    expect(choices.map((c) => [c.label, c.context.cardId, c.context.topic])).toEqual([
      ["Platinum Card", "card_p", "card.close"],
      ["Gold Card", "card_g", "card.close"],
    ]);
    const second = await run(tools, input("close my card", { context: choices[1]?.context }));
    expect(second.answer.kind).toBe("insight");
    expect(tools.evaluatePack).toHaveBeenLastCalledWith("card.close", { cardId: "card_g" });
  });

  it("asks for an amount when an action needs one", async () => {
    const { answer } = await run(fakeTools(), input("cash withdrawal on my platinum card"));
    expect(answer.kind).toBe("clarify");
    expect((answer.suggestions as { context: Record<string, string> }[])[0]?.context).toMatchObject(
      {
        topic: "card.cash_withdrawal",
        cardId: "card_p",
        amount: "1000.00",
      },
    );
  });

  it("refuses investment advice without touching customer data", async () => {
    const tools = fakeTools();
    const { steps, answer } = await run(tools, input("Should I invest in stocks?"));
    expect(steps).not.toContain("fetch_customer_context");
    expect(tools.getProducts).not.toHaveBeenCalled();
    expect(tools.evaluatePack).not.toHaveBeenCalled();
    expect(answer).toMatchObject({ kind: "refusal", headline: "phrase:assistant.refuse_advice" });
  });

  it("validate_numbers: an answer with a figure that is not a fact is replaced", async () => {
    const tools = fakeTools({
      evaluatePack: vi.fn(async () => insight("You would lose QAR 999.00.")),
    });
    const { answer, checks } = await run(tools, input("close my platinum card"));
    expect(checks[0]).toMatch(/^numbers_rejected:/);
    expect(answer).toMatchObject({ kind: "nothing", headline: "phrase:assistant.unavailable" });
  });

  it("guard: advice to buy or selling language never reaches the customer", async () => {
    for (const body of ["I recommend you open a new card.", "Ask about our special offer."]) {
      const tools = fakeTools({ evaluatePack: vi.fn(async () => insight(body)) });
      const { answer, checks } = await run(tools, input("close my platinum card"));
      expect(checks.some((c) => c.startsWith("guard_blocked"))).toBe(true);
      expect(answer.kind).toBe("refusal");
    }
  });

  it("not applicable becomes 'nothing to flag'; a disabled pack becomes 'unavailable'", async () => {
    const nothing = await run(
      fakeTools({ evaluatePack: vi.fn(async () => ({ kind: "nothing" as const })) }),
      input("close my gold card"),
    );
    expect(nothing.answer.headline).toBe("phrase:assistant.nothing");
    const off = await run(
      fakeTools({ evaluatePack: vi.fn(async () => ({ kind: "unavailable" as const })) }),
      input("close my gold card"),
    );
    expect(off.answer.headline).toBe("phrase:assistant.unavailable");
  });

  it("offers follow-up suggestions other than the current topic", async () => {
    const { answer } = await run(fakeTools(), input("hello"));
    const topics = (answer.suggestions as { context: { topic: string } }[]).map(
      (s) => s.context.topic,
    );
    expect(topics).toHaveLength(3);
    expect(answer.kind).toBe("help");
  });
});
