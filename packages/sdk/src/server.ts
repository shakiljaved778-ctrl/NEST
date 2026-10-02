/**
 * Server-side client for the bank's backend. Signs every request with HMAC-SHA256 over
 * timestamp, method, path, raw body and a fresh nonce (X-AMIL-Key / X-AMIL-Timestamp /
 * X-AMIL-Nonce / X-AMIL-Signature).
 * Node only: never ship the secret to a browser.
 */
import { createHmac, randomUUID } from "node:crypto";
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
  type EventRequest,
  EventAck,
  type ExplainChargeRequest,
  ConsentList,
  type ConsentRequest,
  ConsoleSessionResponse,
  ConsoleUserList,
  Consent,
  HEADERS,
  type InsightResponseRequest,
  InsightResponseAck,
  type SessionRequest,
  SessionResponse,
  signingString,
} from "./schemas";

export function signRequest(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string,
  nonce?: string,
): string {
  return createHmac("sha256", secret)
    .update(signingString(timestamp, method, path, body, nonce))
    .digest("hex");
}

export interface ServerClientOptions {
  baseUrl: string;
  keyId: string;
  secret: string;
  fetch?: typeof fetch;
  now?: () => number;
}

export class AmilServerClient {
  constructor(private readonly options: ServerClientOptions) {}

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const raw = body === undefined ? "" : JSON.stringify(body);
    const timestamp = String(Math.floor((this.options.now ?? Date.now)() / 1000));
    const nonce = randomUUID();
    const f = this.options.fetch ?? fetch;
    return f(`${this.options.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        [HEADERS.key]: this.options.keyId,
        [HEADERS.timestamp]: timestamp,
        [HEADERS.nonce]: nonce,
        [HEADERS.signature]: signRequest(this.options.secret, timestamp, method, path, raw, nonce),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: raw }),
    });
  }

  async createSession(req: SessionRequest) {
    return parseResponse(await this.call("POST", "/v1/sessions", req), SessionResponse);
  }

  /** Console staff who can sign in (console backend only). */
  async listConsoleUsers() {
    return parseResponse(await this.call("GET", "/v1/admin/users"), ConsoleUserList);
  }

  /** Mint an 8-hour console token for a staff member (console backend only). */
  async createConsoleSession(consoleUserId: string) {
    return parseResponse(
      await this.call("POST", "/v1/admin/sessions", { consoleUserId }),
      ConsoleSessionResponse,
    );
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

  async grantConsent(req: ConsentRequest) {
    return parseResponse(await this.call("POST", "/v1/consents", req), Consent);
  }

  async listConsents(customerRef: string) {
    return parseResponse(
      await this.call("GET", `/v1/consents/${encodeURIComponent(customerRef)}`),
      ConsentList,
    );
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

  /** Push a product event (bank backend only). Safe to retry with the same idempotency key. */
  async pushEvent(req: EventRequest) {
    return parseResponse(await this.call("POST", "/v1/events", req), EventAck);
  }

  async compare(req: CompareRequest) {
    return parseResponse(await this.call("POST", "/v1/compare", req), CompareResponse);
  }

  /** Ask AMIL: yields status, delta, answer and done events as the server streams them. */
  async *ask(req: AssistantMessageRequest) {
    yield* readAssistantStream(await this.call("POST", "/v1/assistant/messages", req));
  }
}
