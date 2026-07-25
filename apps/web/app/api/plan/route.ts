import { assembleTrip, type NarrationEvent } from "@voyara/agent-core";
import { runtime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/**
 * Streams the agent's work as newline-delimited JSON so the Command Deck can
 * narrate in real time: intent, narrate, gap, present.
 */
export async function POST(req: Request) {
  const { intentText } = (await req.json()) as { intentText?: string };
  const rt = runtime();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: NarrationEvent) =>
        controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));

      try {
        await assembleTrip(
          intentText ?? "",
          { planner: rt.planner, lodging: rt.lodging, air: rt.air },
          { narrate: (e) => send(e) },
        );
      } catch (err) {
        controller.enqueue(
          enc.encode(
            JSON.stringify({
              type: "narrate",
              message: `⚠ ${err instanceof Error ? err.message : "Planning failed."}`,
            }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
