import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { startTelemetry, withSpan } from "./telemetry";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
trace.setGlobalTracerProvider(provider);
afterAll(() => provider.shutdown());

describe("tracing (D-070)", () => {
  it("names request spans by route pattern, never the raw URL with customer data", async () => {
    exporter.reset();
    const app = await buildApp({ checks: {} });
    app.get("/v1/things/:customerRef", () => ({ ok: true }));
    await app.inject({ method: "GET", url: "/v1/things/DDB-C-0001?name=Khalid" });
    const spans = exporter.getFinishedSpans();
    expect(spans.map((s) => s.name)).toContain("GET /v1/things/:customerRef");
    const span = spans.find((s) => s.name === "GET /v1/things/:customerRef");
    expect(span?.attributes["http.response.status_code"]).toBe(200);
    const all = JSON.stringify(spans.map((s) => [s.name, s.attributes]));
    expect(all).not.toContain("DDB-C-0001");
    expect(all).not.toContain("Khalid");
  });

  it("child spans record failures without their messages", async () => {
    exporter.reset();
    await expect(
      withSpan("amil.test", { "amil.pack": "card.close" }, () =>
        Promise.reject(new Error("secret detail")),
      ),
    ).rejects.toThrow("secret detail");
    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe("amil.test");
    expect(span?.status).toEqual({ code: 2, message: "error" });
    expect(JSON.stringify(span?.events ?? [])).not.toContain("secret");
  });

  it("is off without an OTLP endpoint", async () => {
    expect(await startTelemetry({}, "amil-api")).toBeNull();
  });
});
