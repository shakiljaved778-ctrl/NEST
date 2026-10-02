/**
 * OpenTelemetry tracing (D-070). Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set; without it every
 * span is a no-op. Spans carry route patterns, pack keys, severities and outcomes, never customer
 * references, names, figures or free text: traces leave the audit boundary, so they hold no data
 * the audit log is there to protect. The audit trail stays separate from logs and traces.
 */
import { type Attributes, type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import type { FastifyInstance } from "fastify";
import { API_VERSION } from "./version";

export const tracer = trace.getTracer("amil-api", API_VERSION);

export interface Telemetry {
  shutdown(): Promise<void>;
}

/** Start the SDK with an OTLP/HTTP exporter when an endpoint is configured. */
export async function startTelemetry(
  env: NodeJS.ProcessEnv,
  serviceName: string,
): Promise<Telemetry | null> {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return null;
  const [{ NodeSDK }, { OTLPTraceExporter }, { resourceFromAttributes }] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/exporter-trace-otlp-http"),
    import("@opentelemetry/resources"),
  ]);
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": env.OTEL_SERVICE_NAME ?? serviceName,
      "service.version": API_VERSION,
    }),
    traceExporter: new OTLPTraceExporter(),
  });
  sdk.start();
  return { shutdown: () => sdk.shutdown() };
}

/** Run `fn` in a child span; records failures without their messages (they may hold data). */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: "error" });
      throw error;
    } finally {
      span.end();
    }
  });
}

declare module "fastify" {
  interface FastifyRequest {
    otelSpan?: Span;
  }
}

/** One server span per request, named by method and route pattern (never the raw URL). */
export function traceRequests(app: FastifyInstance): void {
  app.addHook("onRequest", (req, _reply, done) => {
    const route = req.routeOptions.url ?? "unmatched";
    req.otelSpan = tracer.startSpan(`${req.method} ${route}`, {
      attributes: {
        "http.request.method": req.method,
        "http.route": route,
        "amil.request_id": req.id,
      },
    });
    done();
  });
  app.addHook("onResponse", (req, reply, done) => {
    const span = req.otelSpan;
    if (span) {
      span.setAttribute("http.response.status_code", reply.statusCode);
      if (reply.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    }
    done();
  });
}
