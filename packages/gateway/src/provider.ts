import type { Locale } from "@amil/i18n";
import type { FactTemplate } from "./redactor";

/** Section 8 provider interface. Implementations must honour `signal` / `timeoutMs`. */
export interface GenerateRequest {
  systemPrompt: string;
  factTemplate: FactTemplate;
  locale: Locale;
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  model: string;
  latencyMs: number;
}

export interface Provider {
  /** Stable name for audit: "mock" | "anthropic" | "in_country". */
  readonly name: string;
  readonly model: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly reason: "timeout" | "refusal" | "empty" | "http_error" | "network",
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
