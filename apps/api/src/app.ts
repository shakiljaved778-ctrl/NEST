import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { healthRoutes, type HealthDeps } from "./routes/health";

export const API_VERSION = "0.1.0";

export interface AppDeps {
  checks: HealthDeps["checks"];
  logger?: FastifyServerOptions["logger"];
}

/** Build the Fastify app with injected dependencies (testable without real Postgres/Redis). */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: deps.logger ?? false,
    // Request bodies are never logged (pino default); auth headers are redacted in server.ts.
    genReqId: () => crypto.randomUUID(),
  });

  // Customer-facing surfaces must never see internal errors (section 7).
  app.setErrorHandler((err: { statusCode?: number }, req, reply) => {
    req.log.error({ err }, "request failed");
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    return reply.code(status).send({ error: status === 500 ? "internal_error" : "bad_request" });
  });

  healthRoutes(app, { checks: deps.checks, version: API_VERSION });
  return app;
}
