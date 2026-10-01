/**
 * Browser-safe client used by the widget with a short-lived session token minted by the bank's
 * backend (POST /v1/sessions). It never sees the bank's API secret.
 */
import { parseResponse } from "./http";
import { readAssistantStream } from "./sse";
import {
  Alert,
  AlertList,
  ChargeExplanation,
  type AssistantMessageRequest,
  type CheckRequest,
  type CompareRequest,
  CompareResponse,
  CheckResponse,
  type ExplainChargeRequest,
  ConsentList,
  type ConsentRequest,
  Consent,
  type InsightResponseRequest,
  InsightResponseAck,
} from "./schemas";

export interface WidgetClientOptions {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
}

export class AmilWidgetClient {
  constructor(private readonly options: WidgetClientOptions) {}

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const f = this.options.fetch ?? fetch;
    return f(`${this.options.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.options.token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  async check(req: CheckRequest) {
    return parseResponse(await this.call("POST", "/v1/checks", req), CheckResponse);
  }

  async respond(insightId: string, req: InsightResponseRequest) {
    return parseResponse(
      await this.call("POST", `/v1/insights/${encodeURIComponent(insightId)}/responses`, req),
      InsightResponseAck,
    );
  }

  async listConsents(customerRef: string) {
    return parseResponse(
      await this.call("GET", `/v1/consents/${encodeURIComponent(customerRef)}`),
      ConsentList,
    );
  }

  async grantConsent(req: ConsentRequest) {
    return parseResponse(await this.call("POST", "/v1/consents", req), Consent);
  }

  async withdrawConsent(customerRef: string, purpose: string) {
    return parseResponse(
      await this.call(
        "DELETE",
        `/v1/consents/${encodeURIComponent(customerRef)}?purpose=${encodeURIComponent(purpose)}`,
      ),
      ConsentList,
    );
  }
  async listAlerts(customerRef: string, locale?: "en" | "ar") {
    const q = `customerRef=${encodeURIComponent(customerRef)}${locale ? `&locale=${locale}` : ""}`;
    return parseResponse(await this.call("GET", `/v1/alerts?${q}`), AlertList);
  }

  async markAlertRead(alertId: string) {
    return parseResponse(
      await this.call("POST", `/v1/alerts/${encodeURIComponent(alertId)}/read`, {}),
      Alert,
    );
  }

  async explainCharge(req: ExplainChargeRequest) {
    return parseResponse(await this.call("POST", "/v1/explain-charge", req), ChargeExplanation);
  }

  async compare(req: CompareRequest) {
    return parseResponse(await this.call("POST", "/v1/compare", req), CompareResponse);
  }

  /** Ask AMIL: yields status, delta, answer and done events as the server streams them. */
  async *ask(req: AssistantMessageRequest) {
    yield* readAssistantStream(await this.call("POST", "/v1/assistant/messages", req));
  }
}
