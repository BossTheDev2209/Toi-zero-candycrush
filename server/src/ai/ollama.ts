import type { AiAskResult } from "./provider";

export interface AskOllamaInput {
  baseUrl: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}

export async function askOllama(input: AskOllamaInput): Promise<AiAskResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const body = {
    model: input.model,
    stream: false,
    options: { num_predict: input.maxTokens },
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: "", error: `Ollama HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    return {
      ok: true,
      text: data.message?.content ?? "",
      tokensIn: data.prompt_eval_count,
      tokensOut: data.eval_count,
    };
  } catch (e: any) {
    return { ok: false, text: "", error: e?.message ?? String(e) };
  }
}
