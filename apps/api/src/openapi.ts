import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import {
  Alert,
  AssistantAnswer,
  AssistantMessageRequest,
  AlertList,
  AlertListQuery,
  ChargeExplanation,
  CheckRequest,
  CheckResponse,
  CompareRequest,
  CompareResponse,
  Consent,
  ConsentList,
  ConsentPurpose,
  ConsentRequest,
  ErrorResponse,
  EventAck,
  EventRequest,
  ExplainChargeRequest,
  InsightResponseAck,
  InsightResponseRequest,
  SessionRequest,
  SessionResponse,
} from "@amil/sdk";
import { z } from "zod";
import { type Permission, PERMISSIONS } from "./admin/rbac";
import * as Admin from "./admin/schemas";
import { API_VERSION } from "./version";

/** OpenAPI 3.1 document generated from the same Zod schemas that validate requests. */
export function buildOpenApiDocument(): object {
  const registry = new OpenAPIRegistry();
  const hmac = registry.registerComponent("securitySchemes", "BankHmac", {
    type: "apiKey",
    in: "header",
    name: "X-AMIL-Signature",
    description:
      "Bank-to-AMIL calls. Send X-AMIL-Key (key id), X-AMIL-Timestamp (unix seconds, +/-5 min), optionally X-AMIL-Nonce (16-64 letters, digits or hyphens; recommended: a UUID per request) and X-AMIL-Signature = hex HMAC-SHA256(secret, `${timestamp}.${METHOD}.${path-with-query}.${raw-body}` followed by `.${nonce}` when a nonce is sent). Each signature is accepted once.",
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
    path: "/v1/alerts",
    summary: "A customer's proactive alerts (rewards expiry, account dormancy), newest first",
    description:
      "Alerts are written by AMIL's scheduled runs for customers who consented to proactive alerts. Each carries the insight card exactly as computed and audited. Withdrawing that consent hides them.",
    security,
    request: { query: AlertListQuery },
    responses: { 200: json(AlertList, "Alerts"), ...errors },
  });
  registry.registerPath({
    method: "post",
    path: "/v1/alerts/{id}/read",
    summary: "Mark an alert as read",
    security,
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: json(Alert, "The alert"), ...errors },
  });
  registry.registerPath({
    method: "post",
    path: "/v1/explain-charge",
    summary: "Explain a fee line on the customer's statement",
    description:
      "Computed from the bank's published fee schedule (the version in force when the fee posted) and the customer's own transactions. No model is used. Without consent, general information only.",
    security,
    request: { body: json(ExplainChargeRequest, "Customer and transaction") },
    responses: { 200: json(ChargeExplanation, "Explanation"), ...errors },
  });
  registry.registerPath({
    method: "post",
    path: "/v1/compare",
    summary: "Compare the customer's own options side by side",
    description:
      "settlement_timing, min_vs_custom_payment, deposit_break_vs_wait. Every figure is computed by the same engine as the pre-action checks; the summary copy is bank-approved. Without consent: kind generic.",
    security,
    request: { body: json(CompareRequest, "Scenario and product") },
    responses: { 200: json(CompareResponse, "Options"), ...errors },
  });
  registry.registerPath({
    method: "post",
    path: "/v1/assistant/messages",
    summary: "Ask AMIL: a question about the customer's own products (server-sent events)",
    description:
      "Responds with text/event-stream: `status` events as each step completes (classify_intent, fetch_customer_context, compute, draft_answer, validate_numbers, guard, respond), `delta` events with the validated answer text, one `answer` event (schema below), then `done`. On failure: `error` with a generic code, then `done`. The question is classified locally and never sent to a model.",
    security,
    request: { body: json(AssistantMessageRequest, "Question") },
    responses: {
      200: {
        description: "Event stream; the `answer` event carries this object",
        content: { "text/event-stream": { schema: AssistantAnswer } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: "post",
    path: "/v1/events",
    summary: "Push a product event (bank backend only, webhook-style)",
    description:
      "Idempotent on idempotencyKey: the first delivery returns 201, any retry 200 with duplicate: true.",
    security: [{ [hmac.name]: [] }],
    request: { body: json(EventRequest, "Event") },
    responses: {
      201: json(EventAck, "Recorded"),
      200: json(EventAck, "Already recorded (retry)"),
      ...errors,
    },
  });
  registerConsolePaths(registry, hmac.name, errors);

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

type Registry = OpenAPIRegistry;
type Errors = Record<number, { description: string; content: object }>;

/** Console API (`/v1/admin/*`): each route lists the permission it needs and the roles holding it. */
function registerConsolePaths(registry: Registry, hmacName: string, errors: Errors) {
  const consoleAuth = registry.registerComponent("securitySchemes", "ConsoleSession", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "8-hour console token for a bank staff member, minted by the console backend via POST /v1/admin/sessions. Every call re-reads the user and checks the role.",
  });
  const ok = { description: "OK", content: { "application/json": { schema: z.object({}) } } };
  const roles = (p: Permission) => `Permission \`${p}\` (${PERMISSIONS[p].join(", ")}).`;
  const route = (
    method: "get" | "post" | "patch",
    path: string,
    summary: string,
    permission: Permission | null,
    request: Parameters<Registry["registerPath"]>[0]["request"] = undefined,
    status = 200,
  ) =>
    registry.registerPath({
      method,
      path,
      summary,
      tags: ["Console"],
      ...(permission ? { description: roles(permission) } : {}),
      security: [{ [permission ? consoleAuth.name : hmacName]: [] }],
      ...(request ? { request } : {}),
      responses: { [status]: ok, ...errors },
    });
  const body = (schema: z.ZodType) => ({
    body: { content: { "application/json": { schema } } },
  });

  route("get", "/v1/admin/users", "Staff who can sign in (console backend only)", null);
  route(
    "post",
    "/v1/admin/sessions",
    "Mint a console token for a staff member (console backend only)",
    null,
    body(Admin.ConsoleSessionRequest),
    201,
  );
  route(
    "get",
    "/v1/admin/me",
    "The signed-in staff member and their permissions",
    "dashboard:read",
  );
  route(
    "get",
    "/v1/admin/dashboard",
    "Insights shown, responses, reconsidered actions, value protected, validator rejections, latency",
    "dashboard:read",
    { query: Admin.DateRangeQuery },
  );
  route(
    "get",
    "/v1/admin/rule-packs",
    "Packs with live version, schedule and history",
    "packs:read",
  );
  route(
    "post",
    "/v1/admin/rule-packs/{key}/{variant}/versions",
    "New parameter version (validated against the pack schema; diff recorded)",
    "packs:write",
    { params: Admin.PackParams, ...body(Admin.PackVersionRequest) },
    201,
  );
  route(
    "patch",
    "/v1/admin/rule-packs/{key}/{variant}",
    "Pack kill switch (disabled packs return kind: none)",
    "killswitch:write",
    { params: Admin.PackParams, ...body(Admin.EnabledRequest) },
  );
  route("get", "/v1/admin/templates", "Approved copy and drafts", "templates:read", {
    query: Admin.TemplateListQuery,
  });
  route(
    "post",
    "/v1/admin/templates/preview",
    "Render draft copy against a demo customer (copy checks included)",
    "templates:read",
    body(Admin.TemplatePreviewRequest),
  );
  route(
    "get",
    "/v1/admin/templates/{id}",
    "A template with its versions and history",
    "templates:read",
    {
      params: Admin.IdParam,
    },
  );
  route(
    "post",
    "/v1/admin/templates",
    "New draft version of a template (copy checks run)",
    "templates:write",
    body(Admin.TemplateDraftRequest),
    201,
  );
  route(
    "post",
    "/v1/admin/templates/{id}/transitions",
    "Approval workflow: submit (product), approve (compliance), sharia_approve (sharia, Islamic copy), reject",
    "templates:read",
    { params: Admin.IdParam, ...body(Admin.TemplateTransitionRequest) },
  );
  route("patch", "/v1/admin/templates/{id}", "Template kill switch", "killswitch:write", {
    params: Admin.IdParam,
    ...body(Admin.EnabledRequest),
  });
  route("get", "/v1/admin/approvals", "Recent console changes (approval log)", "packs:read");
  route(
    "get",
    "/v1/admin/audit",
    "Search the audit log (customer refs matched by hash)",
    "audit:read",
    {
      query: Admin.AuditQuery,
    },
  );
  route("get", "/v1/admin/audit/verify", "Verify the bank's whole hash chain", "audit:read");
  route(
    "get",
    "/v1/admin/activity",
    "Console activity (sign-ins, customer-level reads and exports) and changes, newest first",
    "audit:read",
  );
  route("get", "/v1/admin/audit/export", "Export events as CSV or JSON", "audit:export", {
    query: Admin.AuditExportQuery,
  });
  route("get", "/v1/admin/audit/{id}", "One event in full, with its chain check", "audit:read", {
    params: Admin.IdParam,
  });
  route(
    "get",
    "/v1/admin/complaints",
    "Complaints lookup: what a customer was shown and how they responded",
    "complaints:read",
    { query: Admin.ComplaintsQuery },
  );
  route(
    "get",
    "/v1/admin/compliance",
    "Compliance pack: model card, data flow, fields read, redaction proof, retention",
    "compliance:read",
  );
}
