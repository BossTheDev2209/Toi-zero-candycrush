import type { AiAskResult } from "./provider";

export interface AskOllamaInput {
  baseUrl: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  signal?: AbortSignal;
  /**
   * Passed to Ollama as `keep_alive`. "0" unloads the model from RAM right after
   * the reply (slower next request, no RAM squatting). "5m" keeps it loaded for
   * 5 minutes. "-1" forever. Default in this codebase: "0".
   */
  keepAlive?: string;
}

/**
 * Calls Ollama's /api/chat with `stream: true` and aggregates the NDJSON chunks.
 *
 * Streaming matters for cancellation: with `stream: false` Ollama keeps generating
 * server-side even if the HTTP client disconnects (the model is already in RAM and
 * generation is bound to the request). With streaming, dropping the connection
 * causes Ollama to halt generation on the next token. That's what the Stop button
 * in the UI relies on — abort the signal, the fetch errors, Ollama stops, RAM
 * returns to the keepalive idle path.
 */
export async function askOllama(input: AskOllamaInput): Promise<AiAskResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const body = {
    model: input.model,
    stream: true,
    options: { num_predict: input.maxTokens },
    // Ollama parses "0" / 0 as unload-immediately; treat unset as "0" here so
    // the default behavior frees RAM after each reply. Cast through unknown to
    // allow the string|number union Ollama actually accepts on the wire.
    keep_alive: (input.keepAlive ?? "0") as unknown,
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };
  let accumulated = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: input.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: "", error: `Ollama HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    // Stream path: read NDJSON, accumulate `message.content` from each frame, capture
    // token counts from the final frame (Ollama emits `done: true` with eval counts).
    if (res.body && typeof (res.body as ReadableStream<Uint8Array>).getReader === "function") {
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line) as {
              message?: { content?: string };
              prompt_eval_count?: number;
              eval_count?: number;
            };
            if (typeof obj.message?.content === "string") accumulated += obj.message.content;
            if (typeof obj.prompt_eval_count === "number") tokensIn = obj.prompt_eval_count;
            if (typeof obj.eval_count === "number") tokensOut = obj.eval_count;
          } catch {
            // ignore malformed line
          }
        }
      }
      return { ok: true, text: accumulated, tokensIn, tokensOut };
    }

    // Fallback for mocks / older runtimes that return a buffered Response: parse as one-shot JSON.
    const text = await res.text();
    try {
      const obj = JSON.parse(text) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };
      return {
        ok: true,
        text: obj.message?.content ?? "",
        tokensIn: obj.prompt_eval_count,
        tokensOut: obj.eval_count,
      };
    } catch {
      return { ok: false, text: "", error: "ollama returned no body" };
    }
  } catch (e: any) {
    if (e?.name === "AbortError" || input.signal?.aborted) {
      // Stopping mid-stream is a normal flow, not a failure. Return what we have.
      return { ok: !!accumulated, text: accumulated, error: accumulated ? undefined : "aborted" };
    }
    return { ok: false, text: "", error: e?.message ?? String(e) };
  }
}
