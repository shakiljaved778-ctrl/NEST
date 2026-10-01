import type { AssistantAnswer } from "@amil/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AmilAssistant, defineAmilAssistant } from "./amil-assistant";

defineAmilAssistant();

const answer: AssistantAnswer = {
  messageId: "m1",
  conversationId: "6f1c2a3b-1111-4222-8333-444455556666",
  intent: "card.close",
  kind: "insight",
  severity: "critical",
  headline: "Closing this card forfeits 42,000 points (about QAR 420.00)",
  body: "Your 42,000 reward points end when the card closes.",
  details: [],
  why: ["Your card has reward points."],
  facts: [
    {
      key: "pointsValue",
      label: "Value of points",
      value: "420.00",
      display: "QAR 420.00",
      unit: "QAR",
      source: "rewards_ledger",
      asOf: "2026-09-30",
    },
  ],
  options: [
    { key: "redeem_points", label: "Redeem points first", deepLink: "ddb://cards/c1/rewards" },
  ],
  suggestions: [
    {
      label: "Why was I charged a fee?",
      message: "Why was I charged a fee?",
      context: { topic: "explain.charge" },
    },
  ],
  comparison: null,
  aiDisclosure: "Figures from Doha Demo Bank records as of 30 Sep 2026.",
};

const sse = (events: [string, unknown][]) =>
  new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(""), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });

const stream = (a: AssistantAnswer) =>
  sse([
    ["status", { step: "classify_intent" }],
    ["status", { step: "compute" }],
    ["delta", { text: a.headline }],
    ["answer", a],
    ["done", {}],
  ]);

async function mount(fetchImpl: typeof fetch, locale: "en" | "ar" = "en"): Promise<AmilAssistant> {
  const el = document.createElement("amil-assistant");
  el.fetchImpl = fetchImpl;
  el.apiBase = "http://api.test";
  el.token = "tok";
  el.customerRef = "DDB-C-0001";
  el.locale = locale;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const $ = (el: AmilAssistant, sel: string) =>
  el.shadowRoot?.querySelector(sel) as HTMLElement | null;
const $$ = (el: AmilAssistant, sel: string) =>
  [...(el.shadowRoot?.querySelectorAll(sel) ?? [])] as HTMLElement[];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<amil-assistant>", () => {
  it("offers starter questions, streams the answer and renders chips, options and disclosure", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(stream(answer)));
    const el = await mount(fetchImpl);
    const starters = $$(el, "button.suggestion");
    expect(starters.map((b) => b.textContent?.trim())).toContain(
      "What happens if I close my card?",
    );
    starters[0]?.click();
    await vi.waitFor(() => expect($(el, ".amil h3")?.textContent).toBe(answer.headline));
    const call = (fetchImpl.mock.calls as unknown as [string, RequestInit][])[0];
    expect(call?.[0]).toBe("http://api.test/v1/assistant/messages");
    expect((call?.[1].headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(call?.[1].body as string)).toEqual({
      customerRef: "DDB-C-0001",
      message: "What happens if I close my card?",
      locale: "en",
      context: { topic: "card.close" },
    });
    expect($(el, ".customer")?.textContent).toBe("What happens if I close my card?");
    expect($(el, '[data-fact="pointsValue"]')?.textContent).toContain("QAR 420.00");
    expect($(el, ".amil")?.getAttribute("data-severity")).toBe("critical");
    expect($(el, "footer")?.textContent).toBe(answer.aiDisclosure);
    expect($(el, "details summary")?.textContent).toBe("Why am I seeing this?");
  });

  it("emits amil-option with the deep link and never navigates", async () => {
    const el = await mount(vi.fn(() => Promise.resolve(stream(answer))));
    await el.ask("close my card");
    const onOption = vi.fn();
    el.addEventListener("amil-option", onOption);
    $(el, '[data-option="redeem_points"]')?.click();
    expect((onOption.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      key: "redeem_points",
      deepLink: "ddb://cards/c1/rewards",
      messageId: "m1",
    });
  });

  it("a suggestion sends its topic (not free text) and keeps the conversation id", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(stream(answer)));
    const el = await mount(fetchImpl);
    await el.ask("close my card");
    await el.updateComplete;
    $(el, ".amil button.suggestion")?.click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    const body: unknown = JSON.parse(
      (fetchImpl.mock.calls as unknown as [string, RequestInit][])[1]?.[1].body as string,
    );
    expect(body).toMatchObject({
      context: { topic: "explain.charge" },
      conversationId: answer.conversationId,
    });
  });

  it("renders a comparison as a table with the best option marked", async () => {
    const chip = (key: string, display: string) => ({
      key,
      label: key,
      value: "1",
      display,
      unit: "QAR",
      source: "computed",
      asOf: "2026-09-30",
    });
    const compared: AssistantAnswer = {
      ...answer,
      kind: "comparison",
      facts: [],
      comparison: {
        compareId: "x",
        scenario: "deposit_break_vs_wait",
        kind: "comparison",
        headline: "h",
        body: "b",
        options: [
          {
            key: "break_today",
            title: "Break today",
            best: false,
            facts: [chip("amountReceived", "QAR 199,487.67")],
            action: null,
          },
          {
            key: "wait_to_maturity",
            title: "Keep to maturity",
            best: true,
            facts: [chip("amountReceived", "QAR 208,500.00")],
            action: null,
          },
        ],
        actions: [],
        disclosure: "",
      },
    };
    const el = await mount(vi.fn(() => Promise.resolve(stream(compared))));
    await el.ask("break or wait");
    await el.updateComplete;
    expect($(el, 'th[data-option="wait_to_maturity"]')?.getAttribute("data-best")).toBe("true");
    expect($(el, "table")?.textContent).toContain("QAR 208,500.00");
  });

  it("is right-to-left in Arabic", async () => {
    const el = await mount(
      vi.fn(() => Promise.resolve(stream(answer))),
      "ar",
    );
    expect($(el, "div[dir]")?.getAttribute("dir")).toBe("rtl");
    expect($(el, ".intro")?.textContent).toContain("اسأل عن منتجاتك");
  });

  it("on failure shows a neutral line and emits amil-unavailable", async () => {
    const el = await mount(vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))));
    const unavailable = vi.fn();
    el.addEventListener("amil-unavailable", unavailable);
    await el.ask("hello");
    await el.updateComplete;
    expect(unavailable).toHaveBeenCalled();
    expect($(el, '[role="status"]')?.textContent).toBe(
      "Ask AMIL is not available right now. Please try again later.",
    );
  });
});
