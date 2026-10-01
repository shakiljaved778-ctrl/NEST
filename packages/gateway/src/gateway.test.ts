import { cardClosePacks, financeEarlySettlementPacks, TEMPLATES } from "@amil/rule-packs";
import {
  fatimaFinance,
  financeThresholds,
  khalidCard,
  NOW,
  thresholds,
} from "@amil/rule-packs/fixtures";
import type { AnyEvaluation } from "@amil/rules-engine";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { MemoryWordingCache } from "./cache";
import { ModelGateway, TemplateRenderError, type WordingRequest } from "./gateway";
import { PROMPTS } from "./prompts.generated";
import { ProviderError, type Provider } from "./provider";
import { AnthropicProvider } from "./providers/anthropic";
import { InCountryProvider } from "./providers/in-country";
import { MockProvider, shortenReference } from "./providers/mock";

const khalid: AnyEvaluation = cardClosePacks.conventional.evaluate(
  khalidCard(),
  cardClosePacks.conventional.defaultParameters,
  thresholds,
  NOW,
);
const fatima: AnyEvaluation = financeEarlySettlementPacks.islamic.evaluate(
  fatimaFinance(),
  financeEarlySettlementPacks.islamic.defaultParameters,
  financeThresholds,
  NOW,
);

function request(overrides: Partial<WordingRequest> = {}): WordingRequest {
  const t = TEMPLATES.find(
    (x) => x.key === "card.close.conventional.critical" && x.locale === "en",
  );
  if (!t) throw new Error("template");
  return {
    action: "card.close",
    variant: "conventional",
    locale: "en",
    evaluation: khalid,
    template: { key: t.key, version: t.version, headline: t.headline, body: t.body },
    modelMode: "redacted",
    display: { locale: "en", digitStyle: "latn" },
    ...overrides,
  };
}
const respond = (headline: string, body: string) =>
  new MockProvider({ respond: () => JSON.stringify({ headline, body }) });

describe("ModelGateway: template fallback paths", () => {
  it("mode off serves the approved template", async () => {
    const r = await new ModelGateway({ redactedProvider: new MockProvider() }).word(
      request({ modelMode: "off" }),
    );
    expect(r).toMatchObject({
      source: "template",
      validatorResult: "not_used",
      reasons: ["model_mode_off"],
      headline: "Closing this card forfeits 42,000 points (about QAR 420.00)",
    });
  });

  it("no provider for the mode serves the template", async () => {
    const r = await new ModelGateway({ redactedProvider: new MockProvider() }).word(
      request({ modelMode: "in_country" }),
    );
    expect(r).toMatchObject({ source: "template", reasons: ["no_provider_for_in_country"] });
  });

  it.each([
    [
      "an invented amount",
      respond("Closing this card loses QAR 500", "Act soon."),
      "number_not_in_facts:500",
    ],
    [
      "Arabic-Indic altered digits",
      respond("إغلاق البطاقة يفقدك ٤٢١ نقطة", "نص"),
      "number_not_in_facts:421",
    ],
    [
      "a selling term",
      respond("Closing this card forfeits 42,000 points", "Ask about our special offer instead."),
      "banned_term:offer",
    ],
    [
      "an exclamation mark",
      respond("Wait! You lose 42,000 points", "Redeem first."),
      "exclamation_mark",
    ],
    ["a headline over 90 characters", respond("x".repeat(91), "Body."), "schema_mismatch"],
    [
      "non-JSON output",
      new MockProvider({ respond: () => "Sure, here is the wording" }),
      "not_json",
    ],
  ] as const)(
    "rejects model output with %s and serves the template",
    async (_name, provider, reason) => {
      const warn = vi.fn<(obj: { reasons?: string[] }, msg: string) => void>();
      const r = await new ModelGateway({
        redactedProvider: provider,
        logger: { info: vi.fn(), warn },
      }).word(request());
      expect(r.source).toBe("template");
      expect(r.validatorResult).toBe("rejected");
      expect(r.reasons).toContain(reason);
      expect(r.headline).toBe("Closing this card forfeits 42,000 points (about QAR 420.00)");
      expect(
        warn.mock.calls.some(
          ([obj, msg]) => msg === "validator_rejected" && (obj.reasons ?? []).includes(reason),
        ),
      ).toBe(true);
    },
  );

  it("rejects conventional terminology in Islamic wording", async () => {
    const t = TEMPLATES.find(
      (x) => x.key === "finance.early_settlement.islamic.critical" && x.locale === "en",
    );
    if (!t) throw new Error("template");
    const r = await new ModelGateway({
      redactedProvider: respond("Settle your loan on 19 Oct 2026", "Interest is lower."),
    }).word(
      request({
        action: "finance.early_settlement",
        variant: "islamic",
        evaluation: fatima,
        template: { key: t.key, version: 1, headline: t.headline, body: t.body },
      }),
    );
    expect(r.validatorResult).toBe("rejected");
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        "conventional_term_in_islamic_copy:loan",
        "conventional_term_in_islamic_copy:interest",
      ]),
    );
  });

  it("a provider error serves the template", async () => {
    const failing: Provider = {
      name: "x",
      model: "x",
      generate: () => Promise.reject(new ProviderError("down", "http_error")),
    };
    const r = await new ModelGateway({ redactedProvider: failing }).word(request());
    expect(r).toMatchObject({
      source: "template",
      validatorResult: "not_used",
      reasons: ["provider_http_error"],
    });
  });

  it("a template referencing a missing fact is an error, never served", async () => {
    await expect(
      new ModelGateway().word(
        request({ template: { key: "x", version: 1, headline: "Lose {nothing}", body: "b" } }),
      ),
    ).rejects.toBeInstanceOf(TemplateRenderError);
  });
});

describe("ModelGateway: model wording", () => {
  it("uses validated model wording and caches it for 24 h", async () => {
    const cache = new MemoryWordingCache();
    const provider = respond(
      "Closing this card ends 42,000 points worth QAR 420.00",
      "8,000 of them expire on 14 Nov 2026. Redeem them first if you want their value.",
    );
    const spy = vi.spyOn(provider, "generate");
    const gateway = new ModelGateway({ redactedProvider: provider, cache });
    const first = await gateway.word(request());
    expect(first).toMatchObject({
      source: "model",
      validatorResult: "passed",
      provider: "mock",
      headline: "Closing this card ends 42,000 points worth QAR 420.00",
    });
    const second = await gateway.word(request());
    expect(second.source).toBe("cache");
    expect(second.headline).toBe(first.headline);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a timeout serves the template immediately and finishes the wording in the background", async () => {
    const cache = new MemoryWordingCache();
    const slow = new MockProvider({ latencyMs: 80 });
    const gateway = new ModelGateway({ redactedProvider: slow, cache, timeoutMs: 20 });
    const first = await gateway.word(request());
    expect(first).toMatchObject({ source: "template", reasons: ["timeout"] });
    expect(first.latencyMs).toBeLessThan(80);
    await gateway.drain();
    const second = await gateway.word(request());
    expect(second.source).toBe("cache");
  });

  it("the mock provider's default wording always validates (offline demo)", async () => {
    for (const locale of ["en", "ar"] as const) {
      const t = TEMPLATES.find(
        (x) => x.key === "card.close.conventional.critical" && x.locale === locale,
      );
      if (!t) throw new Error("template");
      const r = await new ModelGateway({ redactedProvider: new MockProvider() }).word(
        request({
          locale,
          display: { locale, digitStyle: "arab" },
          template: { key: t.key, version: 1, headline: t.headline, body: t.body },
        }),
      );
      expect(r).toMatchObject({ source: "model", validatorResult: "passed" });
    }
  });

  it("in_country mode sends the same redacted template to the in-perimeter endpoint", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchImpl = vi.fn((url: string, init?: { body?: string }) => {
      calls.push({ url, body: init?.body ?? "" });
      const body = JSON.parse(init?.body ?? "{}") as { messages: { content: string }[] };
      const template = JSON.parse(body.messages[1]?.content ?? "{}") as {
        referenceWording: { headline: string; body: string };
      };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify(shortenReference(template.referenceWording)) } },
            ],
          }),
          { status: 200 },
        ),
      );
    });
    const provider = new InCountryProvider({
      baseUrl: "http://llm.bank.internal/v1",
      model: "local-model",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const r = await new ModelGateway({ inCountryProvider: provider }).word(
      request({ modelMode: "in_country" }),
    );
    expect(r).toMatchObject({ source: "model", provider: "in_country", model: "local-model" });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "http://llm.bank.internal/v1/chat/completions",
    );
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).not.toContain("Khalid");
  });

  it("in_country HTTP errors serve the template", async () => {
    const provider = new InCountryProvider({
      baseUrl: "http://x",
      model: "m",
      fetchImpl: () => Promise.resolve(new Response("no", { status: 503 })),
    });
    const r = await new ModelGateway({ inCountryProvider: provider }).word(
      request({ modelMode: "in_country" }),
    );
    expect(r.reasons).toEqual(["provider_http_error"]);
  });
});

describe("AnthropicProvider", () => {
  const fakeClient = (response: unknown) => ({
    messages: { parse: vi.fn(() => Promise.resolve(response)) },
  });

  it("asks for structured output at low effort with no retries and the request timeout", async () => {
    const client = fakeClient({
      stop_reason: "end_turn",
      parsed_output: { headline: "h", body: "b" },
      model: "claude-opus-5-5",
    });
    const provider = new AnthropicProvider({ client: client as never });
    const res = await provider.generate({
      systemPrompt: "s",
      factTemplate: { referenceWording: { headline: "h", body: "b" } } as never,
      locale: "en",
      maxTokens: 2048,
      timeoutMs: 1500,
    });
    expect(provider.model).toBe("claude-opus-5-5");
    expect(res).toMatchObject({
      text: JSON.stringify({ headline: "h", body: "b" }),
      model: "claude-opus-5-5",
    });
    const [params, options] = client.messages.parse.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(params).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 2048,
      system: "s",
      output_config: { effort: "low" },
    });
    expect(options).toMatchObject({ timeout: 1500, maxRetries: 0 });
  });

  it("treats a refusal as a provider error (the gateway then serves the template)", async () => {
    const provider = new AnthropicProvider({
      client: fakeClient({ stop_reason: "refusal", parsed_output: null, model: "m" }) as never,
    });
    await expect(
      provider.generate({
        systemPrompt: "s",
        factTemplate: {} as never,
        locale: "en",
        maxTokens: 10,
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({ reason: "refusal" });
  });
});

describe("shortenReference", () => {
  it("keeps whole sentences within the limit and never alters text", () => {
    const ref = {
      headline: "H",
      body: "One sentence here. Two sentence here. Three sentence here.",
    };
    expect(shortenReference(ref, 40)).toEqual({
      headline: "H",
      body: "One sentence here. Two sentence here.",
    });
    expect(shortenReference(ref)).toBe(ref);
    // Decimal points are not sentence ends.
    const money = {
      headline: "H",
      body: "You are due a refund of QAR 1,250.00 from the annual fee. Second sentence is here.",
    };
    expect(shortenReference(money, 60).body).toBe(
      "You are due a refund of QAR 1,250.00 from the annual fee.",
    );
  });
});

describe("prompts", () => {
  it("the generated prompt module matches prompts/insight.v1.md (run `pnpm gen:prompts`)", () => {
    expect(PROMPTS["insight.v1"]).toBe(
      readFileSync(new URL("../prompts/insight.v1.md", import.meta.url), "utf8"),
    );
  });
});
