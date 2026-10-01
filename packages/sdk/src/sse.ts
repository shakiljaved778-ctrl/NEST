import { AmilApiError } from "./http";
import { AssistantStreamEvent, ErrorResponse } from "./schemas";

/**
 * Read a `text/event-stream` response and yield each validated event. Works in browsers and
 * Node (fetch + ReadableStream). Unknown events are skipped; a malformed known event throws.
 */
export async function* readAssistantStream(res: Response): AsyncGenerator<AssistantStreamEvent> {
  if (!res.ok) {
    const json: unknown = await res.json().catch(() => ({}));
    const err = ErrorResponse.safeParse(json);
    throw new AmilApiError(res.status, err.success ? err.data.error : "unknown_error");
  }
  if (!res.body) return;
  const reader: ReadableStreamDefaultReader<Uint8Array> = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let cut = buffer.indexOf("\n\n");
    while (cut >= 0) {
      const event = parseBlock(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 2);
      if (event) yield event;
      cut = buffer.indexOf("\n\n");
    }
    if (done) return;
  }
}

function parseBlock(block: string): AssistantStreamEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  const payload: unknown = JSON.parse(data.join("\n"));
  const parsed = AssistantStreamEvent.safeParse({ event: name, data: payload });
  return parsed.success ? parsed.data : null;
}
