import type { AiAskResult } from "./provider";

export interface AskOpenAiInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  signal?: AbortSignal;
}

export async function askOpenAi(input: AskOpenAiInput): Promise<AiAskResult> {
  if (!input.apiKey) return { ok: false, text: "", error: "OpenAI API key missing" };
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
