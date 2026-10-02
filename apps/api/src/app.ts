import { createHash } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import type { Redis } from "ioredis";
import { HttpError } from "./errors";
import { buildOpenApiDocument } from "./openapi";
import { healthRoutes, type HealthDeps } from "./routes/health";
import { traceRequests } from "./telemetry";
import { ConsoleValidationError } from "./admin/packs";
import { adminRoutes } from "./routes/admin";
import { v1Routes, type V1Deps } from "./routes/v1";
import { API_VERSION } from "./version";

export { API_VERSION };

export interface AppDeps {
  checks: HealthDeps["checks"];
  logger?: FastifyServerOptions["logger"];
  /** Insight API dependencies. Omitted in health-only tests. */
  v1?: V1Deps;
  widgetOrigins?: string[];
  /** Per-minute request limits (D-064). Omitted in tests that do not exercise them. */
  rateLimit?: RateLimits;
}

export interface RateLimits {
  /** Shared counters across API instances; in-memory when omitted. */
  redis?: Redis;
  /** Per bank HMAC key (all of a bank's backend traffic). */
  serverPerMinute: number;
  /** Per widget session token (one customer session). */
  sessionPerMinute: number;
  /** Per console token (one staff member). */
  consolePerMinute: number;
  /** Per client IP, for requests with no credentials (and bad ones). */
  anonymousPerMinute: number;
  /** Ask AMIL, per session token: each turn is the costliest call. */
  assistantPerMinute: number;
}

const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 32);

/**
 * Rate-limit key: the bank's key id for signed calls, the token for bearer calls, else the IP.
 * Tokens are not verified here (authentication does that next); a forged token only buys its own
 * bucket of requests that all fail with 401.
 */
export function rateLimitKey(req: FastifyRequest): string {
  const keyId = req.headers["x-amil-key"];
  if (typeof keyId === "string" && keyId) return `hmac:${keyId}`;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ") && auth.length > 7) {
    const scope = req.url.startsWith("/v1/admin/") ? "console" : "session";
    return `${scope}:${tokenHash(auth.slice(7))}`;
  }
  return `ip:${req.ip}`;
}

/** Build the Fastify app with injected dependencies (testable without real Postgres/Redis). */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger ?? false,
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 64 * 1024,
  });

  // Keep the raw body: HMAC signatures are computed over the exact bytes sent.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    const raw = typeof body === "string" ? body : body.toString("utf8");
    req.rawBody = raw;
    if (raw.length === 0) return done(null, undefined);
    try {
      done(null, JSON.parse(raw));
    } catch {
      done(new HttpError(400, "bad_request"), undefined);
    }
  });

  // Customer-facing surfaces never see internal errors (section 7).
  app.setErrorHandler((err: { statusCode?: number; code?: string }, req, reply) => {
    if (err.statusCode === 429) return reply.code(429).send({ error: "rate_limited" });
    if (err instanceof HttpError)
      return reply.code(err.statusCode).send({
        error: err.code,
        // Console (staff-facing) validation detail only; customer-facing errors stay generic.
        ...(err instanceof ConsoleValidationError ? { issues: err.issues } : {}),
      });
    if (err.statusCode && err.statusCode < 500)
      return reply.code(err.statusCode).send({ error: "bad_request" });
    req.log.error({ err }, "request failed");
    return reply.code(500).send({ error: "internal_error" });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "not_found" }));
  traceRequests(app);

  // Security headers (D-065). The API serves JSON only, so its CSP allows nothing; Swagger UI
  // sets its own policy for /docs. HSTS is sent always (browsers ignore it over plain http).
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  });
  app.addHook("onSend", async (req, reply, payload) => {
    if (!req.url.startsWith("/docs")) {
      reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
      // Customer and staff data: never cached by browsers or proxies.
      if (req.url.startsWith("/v1/")) reply.header("cache-control", "no-store");
    }
    return payload;
  });

  if (deps.rateLimit) {
    const limits = deps.rateLimit;
    await app.register(rateLimit, {
      ...(limits.redis ? { redis: limits.redis, nameSpace: "amil:rl:" } : {}),
      timeWindow: "1 minute",
      keyGenerator: rateLimitKey,
      max: (_req, key) =>
        key.startsWith("hmac:")
          ? limits.serverPerMinute
          : key.startsWith("session:")
            ? limits.sessionPerMinute
            : key.startsWith("console:")
              ? limits.consolePerMinute
              : limits.anonymousPerMinute,
      allowList: (req) => req.url === "/healthz" || req.url === "/readyz",
      // Throttling must not take the service down: if Redis is unreachable, let requests through.
      skipOnError: true,
    });
  }

  await app.register(cors, {
    origin: deps.widgetOrigins ?? false,
    methods: ["GET", "POST", "DELETE", "PATCH"],
    allowedHeaders: ["authorization", "content-type"],
  });

  await app.register(swagger, {
    mode: "static",
    specification: { document: buildOpenApiDocument() as never },
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    staticCSP: true,
    // TLS ends at the bank's load balancer; locally the docs are served over plain http.
    transformStaticCSP: (header) => header.replace(/\s*upgrade-insecure-requests;?/, ""),
  });

  healthRoutes(app, { checks: deps.checks, version: API_VERSION });
  if (deps.v1) {
    v1Routes(app, deps.v1, deps.rateLimit?.assistantPerMinute);
    adminRoutes(app, deps.v1);
  }
  return app;
}
