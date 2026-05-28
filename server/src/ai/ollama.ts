import type { AiAskResult } from "./provider";

/**
 * Coerce a `keep_alive` setting into the shape Ollama actually accepts.
 *   "0"  → 0      (number; unload immediately)
 *   "-1" → -1     (number; keep loaded forever)
 *   "30" → 30     (number; 30 seconds)
 *   "5m" → "5m"   (string; Go duration, kept as-is)
 *   undefined / "" → 0
 */
export function parseKeepAlive(v: string | undefined): string | number {
  const s = (v ?? "0").trim();
  if (!s) return 0;
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

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
 *
 * Reasoning support: passes `think: true` so reason-capable models (qwen3,
 * deepseek-r1, gpt-oss, etc.) split their output into a `message.thinking`
 * stream alongside `message.content`. Models that don't support thinking simply
 * ignore the flag. We aggregate the two streams separately so the UI can
 * collapse the reasoning into its own block.
 *
 * Stats: captures `total_duration` from the final NDJSON frame (Ollama's
 * end-to-end wall time in nanoseconds) and converts to milliseconds, along
 * with prompt + eval token counts.
 */
export async function askOllama(input: AskOllamaInput): Promise<AiAskResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const body = {
    model: input.model,
    stream: true,
    think: true,
    options: { num_predict: input.maxTokens },
    // Ollama parses `keep_alive` two ways: a JSON number = seconds (0 unloads
    // immediately, -1 keeps forever), or a JSON string with a Go time-unit
    // suffix ("5m", "1h"). Bare numeric strings like "0" / "-1" go through
    // time.ParseDuration and fail with "missing unit in duration". Coerce
    // numerics to actual numbers; leave unit-bearing strings as strings.
    keep_alive: parseKeepAlive(input.keepAlive) as unknown,
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };
  let accumulated = "";
  let accumulatedThinking = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let totalDurationNs: number | undefined;
  const startedAt = Date.now();
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

    // Stream path: NDJSON, frame-by-frame. Each frame can carry partial content,
    // partial thinking, or (final frame) `done: true` with eval counts + total_duration.
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
              message?: { content?: string; thinking?: string };
              prompt_eval_count?: number;
              eval_count?: number;
              total_duration?: number;
            };
            if (typeof obj.message?.content === "string") accumulated += obj.message.content;
            if (typeof obj.message?.thinking === "string") accumulatedThinking += obj.message.thinking;
            if (typeof obj.prompt_eval_count === "number") tokensIn = obj.prompt_eval_count;
            if (typeof obj.eval_count === "number") tokensOut = obj.eval_count;
            if (typeof obj.total_duration === "number") totalDurationNs = obj.total_duration;
          } catch {
            // ignore malformed line
          }
        }
      }
      return finalize();
    }

    // Fallback for mocks / older runtimes that return a buffered Response.
    const text = await res.text();
    try {
      const obj = JSON.parse(text) as {
        message?: { content?: string; thinking?: string };
        prompt_eval_count?: number;
        eval_count?: number;
        total_duration?: number;
      };
      accumulated = obj.message?.content ?? "";
      accumulatedThinking = obj.message?.thinking ?? "";
      tokensIn = obj.prompt_eval_count;
      tokensOut = obj.eval_count;
      totalDurationNs = obj.total_duration;
      return finalize();
    } catch {
      return { ok: false, text: "", error: "ollama returned no body" };
    }
  } catch (e: any) {
    if (e?.name === "AbortError" || input.signal?.aborted) {
      // Stopping mid-stream is a normal flow, not a failure. Return what we have.
      return {
        ok: !!accumulated,
        text: accumulated,
        thinking: accumulatedThinking || undefined,
        durationMs: Date.now() - startedAt,
        error: accumulated ? undefined : "aborted",
      };
    }
    return { ok: false, text: "", error: e?.message ?? String(e), durationMs: Date.now() - startedAt };
  }

  function finalize(): AiAskResult {
    // Prefer Ollama's own `total_duration` (covers queueing + model load + eval).
    // Fall back to our wall-clock if the frame was missing it.
    const durationMs = totalDurationNs !== undefined
      ? Math.max(1, Math.round(totalDurationNs / 1_000_000))
      : Date.now() - startedAt;
    return {
      ok: true,
      text: accumulated,
      thinking: accumulatedThinking.trim() || undefined,
      tokensIn,
      tokensOut,
      durationMs,
    };
  }
}
