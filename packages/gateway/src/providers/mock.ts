import type { FactTemplate } from "../redactor";
import type { GenerateRequest, GenerateResult, Provider } from "../provider";

export interface MockProviderOptions {
  /** Simulated latency in ms (default 5). */
  latencyMs?: number;
  /** Custom responder for tests (e.g. adversarial outputs). Default: echo the approved wording. */
  respond?: (template: FactTemplate) => string;
}

/**
 * Offline provider used when no model is configured, and in tests. By default it returns the
 * bank-approved reference wording, which always passes validation, so the demo works with no
 * API key and no network.
 */
export class MockProvider implements Provider {
  readonly name = "mock";
  readonly model = "mock-wording-1";

  constructor(private readonly options: MockProviderOptions = {}) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = performance.now();
    const delay = this.options.latencyMs ?? 5;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      req.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      });
    });
    const text = this.options.respond
      ? this.options.respond(req.factTemplate)
      : JSON.stringify(shortenReference(req.factTemplate.referenceWording));
    return { text, model: this.model, latencyMs: Math.round(performance.now() - started) };
  }
}

/**
 * What a well-behaved model does with long approved copy: keep the headline, keep whole sentences
 * of the body up to the 280-character limit. Facts are never altered, only omitted.
 */
export function shortenReference(
  ref: { headline: string; body: string },
  maxBody = 280,
): { headline: string; body: string } {
  if (ref.body.length <= maxBody) return ref;
  // A sentence ends at ".", "?" or "؟" followed by whitespace or the end, never at a decimal point
  // ("QAR 1,250.00" stays whole).
  const sentences = ref.body.match(/.+?(?:[.?؟](?=\s|$)|$)\s*/gs) ?? [ref.body];
  let body = "";
  for (const s of sentences) {
    if ((body + s).trim().length > maxBody) break;
    body += s;
  }
  return { headline: ref.headline, body: body.trim() || ref.body.slice(0, maxBody) };
}
