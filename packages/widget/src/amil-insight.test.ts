import type { CheckResponse } from "@amil/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AmilInsight, type AmilOptionDetail, defineAmilInsight } from "./amil-insight";

defineAmilInsight();

const critical: CheckResponse = {
  insightId: "8b0c6c48-6a2f-4c71-9a44-5d0f8a1c1e01",
  applicable: true,
  kind: "insight",
  severity: "critical",
  requiresAcknowledgement: true,
  card: {
    headline: "Closing this card forfeits 42,000 points (about QAR 420.00)",
    body: "Your 42,000 reward points, worth about QAR 420.00, end when the card closes.",
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
      {
        key: "continue_closure",
        label: "Continue closing the card",
        deepLink: "ddb://cards/c1/close/confirm",
      },
      {
        key: "talk_to_someone",
        label: "Talk to someone",
        deepLink: "ddb://support/callback?topic=card.close",
      },
    ],
    why: ["Your card has reward points, and points end when a card is closed."],
    aiDisclosure: "Figures from Doha Demo Bank records as of 30 Sep 2026.",
  },
};

async function mount(setup: (el: AmilInsight) => void): Promise<AmilInsight> {
  const el = document.createElement("amil-insight") as AmilInsight;
  setup(el);
  document.body.appendChild(el);
  await el.updateComplete;
  await el.updateComplete;
  return el;
}
const $ = (el: AmilInsight, sel: string) => el.shadowRoot?.querySelector(sel) as HTMLElement | null;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<amil-insight> rendering", () => {
  it("renders headline, body, fact chips, why, options and disclosure", async () => {
    const el = await mount((e) => (e.result = critical));
    expect($(el, "h2")?.textContent).toBe(critical.card?.headline);
    expect($(el, "p.body")?.textContent).toContain("42,000 reward points");
    expect($(el, '[data-fact="pointsValue"]')?.textContent).toContain("QAR 420.00");
    expect($(el, "details li")?.textContent).toContain("points end");
    expect(
      [...(el.shadowRoot?.querySelectorAll("button.option") ?? [])].map((b) =>
        b.getAttribute("data-option"),
      ),
    ).toEqual(["redeem_points", "continue_closure", "talk_to_someone"]);
    expect($(el, "footer")?.textContent).toContain("Doha Demo Bank");
    expect($(el, ".card")?.getAttribute("data-severity")).toBe("critical");
  });

  it("is right-to-left in Arabic", async () => {
    const el = await mount((e) => {
      e.locale = "ar";
      e.result = critical;
    });
    expect($(el, ".card")?.getAttribute("dir")).toBe("rtl");
    expect($(el, "label.ack")?.textContent).toContain("أفهم ذلك");
  });

  it("renders nothing for kind none", async () => {
    const el = await mount(
      (e) =>
        (e.result = {
          ...critical,
          kind: "none",
          applicable: false,
          card: null,
          severity: null,
          requiresAcknowledgement: false,
        }),
    );
    expect($(el, ".card")).toBeNull();
  });
});

describe("<amil-insight> acknowledgement (critical)", () => {
  it("keeps Continue disabled until 'I understand' is ticked; other options stay available", async () => {
    const el = await mount((e) => (e.result = critical));
    const cont = $(el, '[data-option="continue_closure"]') as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    expect(($(el, '[data-option="redeem_points"]') as HTMLButtonElement).disabled).toBe(false);
    const ack = vi.fn();
    el.addEventListener("amil-acknowledged", ack);
    const box = $(el, "label.ack input") as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(cont.disabled).toBe(false);
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it("gates every continue option of the Phase 5 packs, e.g. continue_break", async () => {
    const card = critical.card;
    if (!card) throw new Error("fixture");
    const el = await mount(
      (e) =>
        (e.result = {
          ...critical,
          card: {
            ...card,
            options: [
              {
                key: "keep_until_maturity",
                label: "Keep until maturity",
                deepLink: "ddb://deposits/d1",
              },
              {
                key: "continue_break",
                label: "Continue to break",
                deepLink: "ddb://deposits/d1/break/confirm",
              },
              {
                key: "talk_to_someone",
                label: "Talk to someone",
                deepLink: "ddb://support/callback",
              },
            ],
          },
        }),
    );
    expect(($(el, '[data-option="continue_break"]') as HTMLButtonElement).disabled).toBe(true);
    expect(($(el, '[data-option="keep_until_maturity"]') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("does not require acknowledgement for caution", async () => {
    const el = await mount(
      (e) => (e.result = { ...critical, severity: "caution", requiresAcknowledgement: false }),
    );
    expect($(el, "label.ack")).toBeNull();
    expect(($(el, '[data-option="continue_closure"]') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("<amil-insight> options and responses", () => {
  it("records the response and emits amil-option with the deep link (never navigates itself)", async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: "r1",
            insightId: critical.insightId,
            action: "chose_option",
            at: "2026-09-30T09:00:00.000Z",
          }),
          { status: 201 },
        ),
      ),
    );
    const el = await mount((e) => {
      e.fetchImpl = fetchImpl as unknown as typeof fetch;
      e.token = "tok";
      e.apiBase = "http://api.test";
      e.result = critical;
    });
    const events: AmilOptionDetail[] = [];
    el.addEventListener("amil-option", (e) =>
      events.push((e as CustomEvent<AmilOptionDetail>).detail),
    );
    ($(el, '[data-option="redeem_points"]') as HTMLButtonElement).click();
    expect(events).toEqual([
      {
        insightId: critical.insightId,
        key: "redeem_points",
        deepLink: "ddb://cards/c1/rewards",
        continues: false,
      },
    ]);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`http://api.test/v1/insights/${critical.insightId}/responses`);
    expect(JSON.parse(init?.body as string)).toEqual({
      action: "chose_option",
      optionKey: "redeem_points",
    });
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });
});

describe("<amil-insight> runs the check itself", () => {
  const checkFetch = (status: number, body: unknown) =>
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

  it("calls /v1/checks with the session token and renders the result", async () => {
    const fetchImpl = checkFetch(200, critical);
    const ready = vi.fn();
    document.addEventListener("amil-ready", ready);
    const el = await mount((e) => {
      e.fetchImpl = fetchImpl;
      e.apiBase = "http://api.test";
      e.token = "tok";
      e.action = "card.close";
      e.customerRef = "DDB-C-0001";
      e.cardId = "c1";
    });
    await vi.waitFor(() => expect($(el, "h2")?.textContent).toBe(critical.card?.headline));
    const call = (fetchImpl.mock.calls as unknown as [string, RequestInit][])[0];
    expect(call?.[0]).toBe("http://api.test/v1/checks");
    expect(JSON.parse(call?.[1].body as string)).toEqual({
      action: "card.close",
      customerRef: "DDB-C-0001",
      context: { cardId: "c1" },
      locale: "en",
    });
    expect(ready).toHaveBeenCalled();
    document.removeEventListener("amil-ready", ready);
  });

  it("sends the full context (deposit, amount, months) for Phase 5 actions", async () => {
    const fetchImpl = checkFetch(200, critical);
    await mount((e) => {
      e.fetchImpl = fetchImpl;
      e.apiBase = "http://api.test";
      e.token = "tok";
      e.action = "finance.top_up";
      e.customerRef = "DDB-C-0005";
      e.context = { amount: "20000.00", months: 60 };
      e.financeId = "f1";
      e.locale = "ar";
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const call = (fetchImpl.mock.calls as unknown as [string, RequestInit][]).at(-1);
    expect(JSON.parse(call?.[1].body as string)).toEqual({
      action: "finance.top_up",
      customerRef: "DDB-C-0005",
      context: { amount: "20000.00", months: 60, financeId: "f1" },
      locale: "ar",
    });
  });

  it("on failure shows a neutral line and emits amil-unavailable so the bank flow continues", async () => {
    const unavailable = vi.fn();
    document.addEventListener("amil-unavailable", unavailable);
    const el = await mount((e) => {
      e.fetchImpl = checkFetch(500, { error: "internal_error" });
      e.apiBase = "http://api.test";
      e.token = "tok";
      e.action = "card.close";
      e.customerRef = "DDB-C-0001";
      e.cardId = "c1";
    });
    await vi.waitFor(() =>
      expect($(el, ".unavailable")?.textContent).toBe("Information unavailable"),
    );
    expect($(el, ".unavailable")?.textContent).not.toContain("internal_error");
    expect(unavailable).toHaveBeenCalled();
    document.removeEventListener("amil-unavailable", unavailable);
  });
});
