import { createHash } from "node:crypto";
import type { Locale } from "@amil/i18n";
import { renderTemplate } from "@amil/rule-packs";
import type { AnyEvaluation, Fact, Variant } from "@amil/rules-engine";
import { type WordingCache, WORDING_TTL_SECONDS } from "./cache";
import { type DisplayOptions, formatFact } from "./format";
import { checkModelOutput, type Wording } from "./output";
import { PROMPTS } from "./prompts.generated";
import { type Provider, ProviderError } from "./provider";
import { buildFactTemplate, PROMPT_VERSION, RedactionError } from "./redactor";

export type ModelMode = "redacted" | "in_country" | "off";
export type WordingSource = "model" | "cache" | "template";
export type ValidatorOutcome = "passed" | "rejected" | "not_used";

export interface WordingRequest {
  action: string;
  variant: Variant;
  locale: Locale;
  evaluation: AnyEvaluation;
  /** The approved template selected for this pack/variant/locale/severity. */
  template: { key: string; version: number; headline: string; body: string };
  modelMode: ModelMode;
  display: DisplayOptions;
}

export interface WordingResult extends Wording {
  source: WordingSource;
  provider: string | null;
  model: string | null;
  validatorResult: ValidatorOutcome;
  /** Why model wording was not used (empty when it was). */
  reasons: string[];
  latencyMs: number;
}

export interface GatewayLogger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

export interface GatewayOptions {
  /** Provider for `redacted` mode (anthropic, or mock when no key is configured). */
  redactedProvider?: Provider;
  /** Provider for `in_country` mode. */
  inCountryProvider?: Provider;
  cache?: WordingCache;
  /** Wording deadline (section 7): beyond it the template is served and wording finishes async. */
  timeoutMs?: number;
  maxTokens?: number;
  logger?: GatewayLogger;
}

export class TemplateRenderError extends Error {
  constructor(readonly missing: string[]) {
    super(`Approved template references facts that are absent: ${missing.join(", ")}`);
    this.name = "TemplateRenderError";
  }
}

const noopLogger: GatewayLogger = { info: () => undefined, warn: () => undefined };

/**
 * The model gateway. Facts in, wording out: the model only ever rewords the approved copy using
 * the redacted fact template, and anything it returns is validated. Every failure mode (mode
 * off, no provider, redaction failure, timeout, provider error, invalid or rejected output)
 * yields the bank-approved static template, so the customer always gets correct wording.
 */
export class ModelGateway {
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly logger: GatewayLogger;
  private readonly inflight = new Set<Promise<unknown>>();

  constructor(private readonly options: GatewayOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 1500;
    this.maxTokens = options.maxTokens ?? 2048;
    this.logger = options.logger ?? noopLogger;
  }

  /** Render the approved template (always computed; it is also the reference wording). */
  renderApproved(req: WordingRequest): Wording {
    const format = (f: Fact) => formatFact(f, req.display);
    const headline = renderTemplate(req.template.headline, req.evaluation.facts, format);
    const body = renderTemplate(req.template.body, req.evaluation.facts, format);
    const missing = [...headline.missing, ...body.missing];
    if (missing.length > 0) throw new TemplateRenderError(missing);
    return { headline: headline.text, body: body.text };
  }

  async word(req: WordingRequest): Promise<WordingResult> {
    const started = performance.now();
    const approved = this.renderApproved(req);
    const template = (
      reasons: string[],
      validatorResult: ValidatorOutcome = "not_used",
      provider: Provider | null = null,
    ): WordingResult => ({
      ...approved,
      source: "template",
      provider: provider?.name ?? null,
      model: provider?.model ?? null,
      validatorResult,
      reasons,
      latencyMs: Math.round(performance.now() - started),
    });

    if (req.modelMode === "off") return template(["model_mode_off"]);
    const provider =
      req.modelMode === "in_country"
        ? this.options.inCountryProvider
        : this.options.redactedProvider;
    if (!provider) return template([`no_provider_for_${req.modelMode}`]);

    let factTemplate;
    try {
      factTemplate = buildFactTemplate({
        action: req.action,
        variant: req.variant,
        locale: req.locale,
        evaluation: req.evaluation,
        referenceWording: approved,
        display: req.display,
      });
    } catch (error) {
      if (error instanceof RedactionError) {
        this.logger.warn(
          { findings: error.findings, action: req.action },
          "redaction_failed_closed",
        );
        return template(["redaction_failed"]);
      }
      throw error;
    }

    const cacheKey = createHash("sha256")
      .update(
        JSON.stringify([
          factTemplate,
          req.template.key,
          req.template.version,
          PROMPT_VERSION,
          provider.name,
          provider.model,
        ]),
      )
      .digest("hex");

    const cached = await this.options.cache?.get(cacheKey).catch(() => null);
    if (cached) {
      const check = checkModelOutput(cached, req.evaluation.facts, req.locale, req.variant);
      if (check.ok && check.wording) {
        return {
          ...check.wording,
          source: "cache",
          provider: provider.name,
          model: provider.model,
          validatorResult: "passed",
          reasons: [],
          latencyMs: Math.round(performance.now() - started),
        };
      }
    }

    const generation = this.generateAndValidate(provider, factTemplate, req, cacheKey);
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), this.timeoutMs);
    });
    const outcome = await Promise.race([generation, deadline]);
    clearTimeout(timer);

    if (outcome === "timeout") {
      // Serve the approved template now; the generation continues and warms the cache (section 7).
      this.track(generation);
      this.logger.info(
        { action: req.action, provider: provider.name },
        "wording_timeout_template_served",
      );
      return template(["timeout"], "not_used", provider);
    }
    if (outcome.kind === "error") return template([outcome.reason], "not_used", provider);
    if (outcome.kind === "rejected") return template(outcome.reasons, "rejected", provider);
    return {
      ...outcome.wording,
      source: "model",
      provider: provider.name,
      model: outcome.model,
      validatorResult: "passed",
      reasons: [],
      latencyMs: Math.round(performance.now() - started),
    };
  }

  /** Resolves when background generations started by timed-out requests have finished. */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.inflight]);
  }

  private track(p: Promise<unknown>): void {
    this.inflight.add(p);
    void p.finally(() => this.inflight.delete(p));
  }

  private async generateAndValidate(
    provider: Provider,
    factTemplate: ReturnType<typeof buildFactTemplate>,
    req: WordingRequest,
    cacheKey: string,
  ): Promise<
    | { kind: "ok"; wording: Wording; model: string }
    | { kind: "rejected"; reasons: string[] }
    | { kind: "error"; reason: string }
  > {
    const systemPrompt = PROMPTS[PROMPT_VERSION];
    if (!systemPrompt) return { kind: "error", reason: "prompt_missing" };
    let result;
    try {
      result = await provider.generate({
        systemPrompt,
        factTemplate,
        locale: req.locale,
        maxTokens: this.maxTokens,
        // The provider may finish after the deadline, to warm the cache; bound it generously.
        timeoutMs: this.timeoutMs * 10,
      });
    } catch (error) {
      const reason = error instanceof ProviderError ? `provider_${error.reason}` : "provider_error";
      this.logger.warn({ provider: provider.name, reason }, "wording_provider_failed");
      return { kind: "error", reason };
    }
    const check = checkModelOutput(result.text, req.evaluation.facts, req.locale, req.variant);
    if (!check.ok || !check.wording) {
      this.logger.warn(
        { provider: provider.name, model: result.model, reasons: check.reasons },
        "validator_rejected",
      );
      return { kind: "rejected", reasons: check.reasons };
    }
    await this.options.cache
      ?.set(cacheKey, JSON.stringify(check.wording), WORDING_TTL_SECONDS)
      .catch(() => undefined);
    return { kind: "ok", wording: check.wording, model: result.model };
  }
}
