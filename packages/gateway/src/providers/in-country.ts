import type { GenerateRequest, GenerateResult, Provider } from "../provider";
import { ProviderError } from "../provider";

export interface InCountryProviderOptions {
  /** Base URL of an OpenAI-compatible endpoint hosted inside the bank's perimeter. */
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * `in_country` mode (non-negotiable 6): a model hosted inside the bank's perimeter, reached over
 * an OpenAI-compatible chat-completions endpoint. It receives exactly the same redacted fact
 * template as the hosted model. MVP stub: it works against any compatible server, but is
 * exercised only against a fake in tests.
 */
export class InCountryProvider implements Provider {
  readonly name = "in_country";
  readonly model: string;

  constructor(private readonly options: InCountryProviderOptions) {
    this.model = options.model;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = performance.now();
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const signal = req.signal
      ? AbortSignal.any([req.signal, AbortSignal.timeout(req.timeoutMs)])
      : AbortSignal.timeout(req.timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: req.maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: req.systemPrompt },
            { role: "user", content: JSON.stringify(req.factTemplate) },
          ],
        }),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      throw new ProviderError(
        timedOut ? "timeout" : "network error",
        timedOut ? "timeout" : "network",
      );
    }
    if (!res.ok) throw new ProviderError(`HTTP ${res.status}`, "http_error");
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError("empty completion", "empty");
    return { text, model: this.model, latencyMs: Math.round(performance.now() - started) };
  }
}
