import type { AiAskResult, AiStreamDelta } from "./provider";
import { readSseData } from "./sse";

export interface AskAnthropicInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  signal?: AbortSignal;
  /** When provided, stream tokens live via SSE and forward each delta. */
  onDelta?: (d: AiStreamDelta) => void;
}

export async function askAnthropic(input: AskAnthropicInput): Promise<AiAskResult> {
  if (!input.apiKey) return { ok: false, text: "", error: "Anthropic API key missing" };
  const stream = Boolean(input.onDelta);
  const startedAt = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        system: input.systemPrompt,
        stream,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: input.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: "", error: `Anthropic HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    // Streaming path: parse Anthropic's SSE event stream. Text arrives as
    // `content_block_delta` frames; usage counts in `message_start` /
    // `message_delta`. Extended-thinking deltas (when enabled) come through as
    // `thinking_delta` — forwarded to the reasoning block.
    if (stream && res.body) {
      let text = "";
      let thinking = "";
      let tokensIn: number | undefined;
      let tokensOut: number | undefined;
      try {
        for await (const data of readSseData(res.body as ReadableStream<Uint8Array>)) {
          if (data === "[DONE]") break;
          let obj: any;
          try { obj = JSON.parse(data); } catch { continue; }
          if (obj.type === "message_start") {
            tokensIn = obj.message?.usage?.input_tokens ?? tokensIn;
          } else if (obj.type === "content_block_delta") {
            if (obj.delta?.type === "text_delta" && typeof obj.delta.text === "string") {
              text += obj.delta.text;
              if (obj.delta.text) input.onDelta?.({ content: obj.delta.text });
            } else if (obj.delta?.type === "thinking_delta" && typeof obj.delta.thinking === "string") {
              thinking += obj.delta.thinking;
              if (obj.delta.thinking) input.onDelta?.({ thinking: obj.delta.thinking });
            }
          } else if (obj.type === "message_delta") {
            tokensOut = obj.usage?.output_tokens ?? tokensOut;
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError" || input.signal?.aborted) {
          return { ok: !!text, text, thinking: thinking || undefined, durationMs: Date.now() - startedAt, error: text ? undefined : "aborted" };
        }
        throw e;
      }
      return { ok: true, text, thinking: thinking.trim() || undefined, tokensIn, tokensOut, durationMs: Date.now() - startedAt };
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    return {
      ok: true,
      text,
      tokensIn: data.usage?.input_tokens,
      tokensOut: data.usage?.output_tokens,
      durationMs: Date.now() - startedAt,
    };
  } catch (e: any) {
    if (e?.name === "AbortError" || input.signal?.aborted) {
      return { ok: false, text: "", error: "aborted", durationMs: Date.now() - startedAt };
    }
    return { ok: false, text: "", error: e?.message ?? String(e), durationMs: Date.now() - startedAt };
  }
}
