import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import {
  CheckRequest,
  CheckResponse,
  Consent,
  ConsentList,
  ConsentPurpose,
  ConsentRequest,
  ErrorResponse,
  InsightResponseAck,
  InsightResponseRequest,
  SessionRequest,
  SessionResponse,
} from "@amil/sdk";
import { z } from "zod";
import { API_VERSION } from "./version";

/** OpenAPI 3.1 document generated from the same Zod schemas that validate requests. */
export function buildOpenApiDocument(): object {
  const registry = new OpenAPIRegistry();
  const hmac = registry.registerComponent("securitySchemes", "BankHmac", {
    type: "apiKey",
    in: "header",
    name: "X-AMIL-Signature",
    description:
      "Bank-to-AMIL calls. Send X-AMIL-Key (key id), X-AMIL-Timestamp (unix seconds, +/-5 min) and X-AMIL-Signature = hex HMAC-SHA256(secret, `${timestamp}.${METHOD}.${path-with-query}.${raw-body}`). Each signature is accepted once.",
  });
  const bearer = registry.registerComponent("securitySchemes", "WidgetSession", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "15-minute customer session token minted by the bank backend via POST /v1/sessions.",
  });
  const security = [{ [hmac.name]: [] }, { [bearer.name]: [] }];
  const json = <T extends z.ZodType>(schema: T, description: string) => ({
    description,
    content: { "application/json": { schema } },
  });
  const errors = {
    400: json(ErrorResponse, "Invalid request"),
    401: json(ErrorResponse, "Missing or invalid credentials"),
    403: json(ErrorResponse, "Not allowed for this session"),
    404: json(ErrorResponse, "Unknown customer, product or insight"),
  };

  registry.registerPath({
    method: "post",
    path: "/v1/sessions",
    summary: "Mint a widget session token for a customer (bank backend only)",
    security: [{ [hmac.name]: [] }],
    request: { body: json(SessionRequest, "Customer and scopes") },
    responses: { 201: json(SessionResponse, "Session token (15 minutes)"), ...errors },
  });
  registry.registerPath({
    method: "post",
    path: "/v1/checks",
    summary: "Pre-action check: what the customer gains or loses before confirming an action",
    description:
      "Returns an insight card computed from the customer's own products (consent required), generic product information when no consent is on record, or nothing (kind: none) when there is nothing to show or the bank has disabled the pack or template. Never an error for those cases, so the bank's flow continues.",
    security,
    request: { body: json(CheckRequest, "Action, customer and product") },
    responses: { 200: json(CheckResponse, "Insight, generic information, or none"), ...errors },
  });
  registry.registerPath({
    method: "post",
    path: "/v1/insights/{id}/responses",
    summary: "Record the customer's response to an insight",
    security,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: json(InsightResponseRequest, "Response"),
    },
    responses: { 201: json(InsightResponseAck, "Recorded"), ...errors },
  });
  registry.registerPath({
    method: "post",
    path: "/v1/consents",
    summary: "Record a consent",
    security,
    request: { body: json(ConsentRequest, "Consent") },
    responses: { 201: json(Consent, "Recorded"), ...errors },
  });
  registry.registerPath({
    method: "get",
    path: "/v1/consents/{customerRef}",
    summary: "List a customer's consents",
    security,
    request: { params: z.object({ customerRef: z.string() }) },
    responses: { 200: json(ConsentList, "Consents"), ...errors },
  });
  registry.registerPath({
    method: "delete",
    path: "/v1/consents/{customerRef}",
    summary: "Withdraw a consent purpose",
    security,
    request: {
      params: z.object({ customerRef: z.string() }),
      query: z.object({ purpose: ConsentPurpose }),
    },
    responses: { 200: json(ConsentList, "Consents after withdrawal"), ...errors },
  });
  registry.registerPath({
    method: "get",
    path: "/healthz",
    summary: "Liveness",
    responses: { 200: { description: "Up" } },
  });
  registry.registerPath({
    method: "get",
    path: "/readyz",
    summary: "Readiness (Postgres, Redis)",
    responses: { 200: { description: "Ready" }, 503: { description: "Not ready" } },
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "AMIL API",
      version: API_VERSION,
      description:
        "Pre-decision intelligence for retail banking. AMIL informs and never executes: options are deep links into the bank's own app. Demo data: Doha Demo Bank is fictional.",
    },
    servers: [{ url: "/" }],
  });
}
