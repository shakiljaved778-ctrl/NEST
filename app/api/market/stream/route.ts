/**
 * Server-Sent Events "live" quote stream (Premium only).
 *
 * Demonstrates near-real-time streaming with mock data. For the free tier this
 * returns 402 so the UI shows an upgrade CTA. In production this would proxy a
 * real WebSocket/streaming feed; the SSE contract to the client stays the same.
 */
import { getMarketDataService } from "@/services/market";
import { param, planFromRequest } from "@/lib/market/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const plan = planFromRequest(req);
  if (plan !== "premium") {
    return new Response(
      JSON.stringify({ error: "Live streaming is a Premium feature." }),
      { status: 402, headers: { "content-type": "application/json" } },
    );
  }

  const symbols = (param(req, "symbols") ?? "QSE")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const svc = getMarketDataService();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = async () => {
        if (closed) return;
        try {
          const quotes = await svc.getQuotes(symbols, "premium");
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ quotes, t: Date.now() })}\n\n`),
          );
        } catch {
          /* ignore transient errors */
        }
      };
      void send();
      const interval = setInterval(send, 2000);
      // Stop after ~5 min to avoid dangling serverless connections.
      const stop = setTimeout(() => {
        closed = true;
        clearInterval(interval);
        controller.close();
      }, 300_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearTimeout(stop);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
