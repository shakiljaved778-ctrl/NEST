import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { HttpError } from "./errors";
import { buildOpenApiDocument } from "./openapi";
import { healthRoutes, type HealthDeps } from "./routes/health";
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

  await app.register(cors, {
    origin: deps.widgetOrigins ?? false,
    methods: ["GET", "POST", "DELETE", "PATCH"],
    allowedHeaders: ["authorization", "content-type"],
  });

  await app.register(swagger, {
    mode: "static",
    specification: { document: buildOpenApiDocument() as never },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  healthRoutes(app, { checks: deps.checks, version: API_VERSION });
  if (deps.v1) {
    v1Routes(app, deps.v1);
    adminRoutes(app, deps.v1);
  }
  return app;
}
