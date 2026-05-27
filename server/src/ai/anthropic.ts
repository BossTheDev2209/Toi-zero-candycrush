import type { AiAskResult } from "./provider";

export interface AskAnthropicInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}

export async function askAnthropic(input: AskAnthropicInput): Promise<AiAskResult> {
  if (!input.apiKey) return { ok: false, text: "", error: "Anthropic API key missing" };
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
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: "", error: `Anthropic HTTP ${res.status}: ${text.slice(0, 200)}` };
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
    };
  } catch (e: any) {
    return { ok: false, text: "", error: e?.message ?? String(e) };
  }
}
