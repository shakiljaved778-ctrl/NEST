import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { GenerateRequest, GenerateResult, Provider } from "../provider";
import { ProviderError } from "../provider";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/** Plain schema for structured output; length limits are enforced afterwards by WordingSchema. */
const OutputSchema = z.object({ headline: z.string(), body: z.string() });

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  client?: Anthropic;
}

/**
 * Claude via the official SDK, in `redacted` mode: the request carries only the redacted fact
 * template. The hard timeout is the gateway's (1.5 s by default), with no SDK retries. A
 * refusal, timeout or invalid output is not retried and not routed to a fallback model: the
 * gateway falls back to the bank-approved template (D-017).
 */
export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly client: Anthropic;

  constructor(options: AnthropicProviderOptions = {}) {
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.client = options.client ?? new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = performance.now();
    let response;
    try {
      response = await this.client.messages.parse(
        {
          model: this.model,
          max_tokens: req.maxTokens,
          system: req.systemPrompt,
          // Short, fact-bound wording: lowest effort keeps latency inside the budget.
          output_config: { effort: "low", format: zodOutputFormat(OutputSchema) },
          messages: [{ role: "user", content: JSON.stringify(req.factTemplate) }],
        },
        { timeout: req.timeoutMs, maxRetries: 0, ...(req.signal ? { signal: req.signal } : {}) },
      );
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionTimeoutError)
        throw new ProviderError("timeout", "timeout");
      if (error instanceof Anthropic.APIConnectionError)
        throw new ProviderError(error.message, "network");
      if (error instanceof Anthropic.APIError)
        throw new ProviderError(`HTTP ${String(error.status)}`, "http_error");
      throw error;
    }
    if (response.stop_reason === "refusal") throw new ProviderError("model declined", "refusal");
    if (!response.parsed_output) throw new ProviderError("no structured output", "empty");
    return {
      text: JSON.stringify(response.parsed_output),
      model: response.model,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
