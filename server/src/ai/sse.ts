/**
 * Read an SSE / line-delimited HTTP response body and yield each non-empty
 * `data:` payload as a raw string. Shared by the Anthropic and OpenAI streaming
 * providers, which both speak Server-Sent Events but with different JSON shapes
 * on top.
 *
 * Yields the text after `data:` verbatim (trimmed). The caller decides whether
 * to JSON-parse it and how to interpret it. The OpenAI sentinel `[DONE]` and any
 * `event:` / comment lines are passed through as-is or skipped by the caller.
 */
export async function* readSseData(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line || line.startsWith(":") || line.startsWith("event:")) continue;
        if (line.startsWith("data:")) {
          yield line.slice(5).trim();
        }
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) yield tail.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}
