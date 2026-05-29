import type { AiAskResult, AiStreamDelta } from "./provider";
import { readSseData } from "./sse";

export interface AskOpenAiInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  signal?: AbortSignal;
  /** When provided, stream tokens live via SSE and forward each delta. */
  onDelta?: (d: AiStreamDelta) => void;
}

export async function askOpenAi(input: AskOpenAiInput): Promise<AiAskResult> {
  if (!input.apiKey) return { ok: false, text: "", error: "OpenAI API key missing" };
  const stream = Boolean(input.onDelta);
  const startedAt = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        stream,
        // Ask for a final usage frame on the stream so we can still report tokens.
        ...(stream ? { stream_options: { include_usage: true } } : {}),
        messages: [
          { role: "system", content: input.systemPrompt },
          ...input.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
      signal: input.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: "", error: `OpenAI HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    // Streaming path: SSE frames carry `choices[0].delta.content`; the final
    // frame (with stream_options.include_usage) carries `usage`.
    if (stream && res.body) {
      let text = "";
      let tokensIn: number | undefined;
      let tokensOut: number | undefined;
      try {
        for await (const data of readSseData(res.body as ReadableStream<Uint8Array>)) {
          if (data === "[DONE]") break;
          let obj: any;
          try { obj = JSON.parse(data); } catch { continue; }
          const chunk = obj.choices?.[0]?.delta?.content;
          if (typeof chunk === "string" && chunk) {
            text += chunk;
            input.onDelta?.({ content: chunk });
          }
          if (obj.usage) {
            tokensIn = obj.usage.prompt_tokens ?? tokensIn;
            tokensOut = obj.usage.completion_tokens ?? tokensOut;
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError" || input.signal?.aborted) {
          return { ok: !!text, text, durationMs: Date.now() - startedAt, error: text ? undefined : "aborted" };
        }
        throw e;
      }
      return { ok: true, text, tokensIn, tokensOut, durationMs: Date.now() - startedAt };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      ok: true,
      text: data.choices?.[0]?.message?.content ?? "",
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
      durationMs: Date.now() - startedAt,
    };
  } catch (e: any) {
    if (e?.name === "AbortError" || input.signal?.aborted) {
      return { ok: false, text: "", error: "aborted", durationMs: Date.now() - startedAt };
    }
    return { ok: false, text: "", error: e?.message ?? String(e), durationMs: Date.now() - startedAt };
  }
}
