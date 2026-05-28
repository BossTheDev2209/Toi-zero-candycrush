import type { AppConfig } from "../config";
import { askOllama } from "./ollama";
import { askAnthropic } from "./anthropic";
import { askOpenAi } from "./openai";
import { askClaudeCli } from "./claudeCli";

export type ProviderName = "anthropic" | "openai" | "ollama" | "claude-cli";

export interface AiAskInput {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  /** When aborted, the provider should stop generation ASAP and return whatever partial text it has. */
  signal?: AbortSignal;
}

export interface AiAskResult {
  ok: boolean;
  text: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
  /** Reasoning content from think-capable models (qwen3, deepseek-r1, etc.) when available. */
  thinking?: string;
  /** End-to-end wall time of this provider call, milliseconds. Set by every provider. */
  durationMs?: number;
}

export interface AiProvider {
  name: ProviderName;
  model: string;
  ask(input: AiAskInput): Promise<AiAskResult>;
}

export interface AiProviderDispatcher {
  current(): AiProvider;
}

export function buildProvider(ai: AppConfig["ai"]): AiProvider {
  const provider = ai.provider ?? "ollama";
  const maxTokens = ai.maxTokens ?? 1024;

  if (provider === "anthropic") {
    const model = ai.anthropicModel || "claude-sonnet-4-5";
    return {
      name: "anthropic",
      model,
      ask: (input) => askAnthropic({
        apiKey: ai.anthropicApiKey ?? "",
        model,
        systemPrompt: input.systemPrompt,
        messages: input.messages,
        maxTokens: input.maxTokens ?? maxTokens,
        signal: input.signal,
      }),
    };
  }
  if (provider === "openai") {
    const model = ai.openaiModel || "gpt-4o-mini";
    return {
      name: "openai",
      model,
      ask: (input) => askOpenAi({
        apiKey: ai.openaiApiKey ?? "",
        model,
        systemPrompt: input.systemPrompt,
        messages: input.messages,
        maxTokens: input.maxTokens ?? maxTokens,
        signal: input.signal,
      }),
    };
  }
  if (provider === "claude-cli") {
    const model = ai.claudeCliModel || "sonnet";
    return {
      name: "claude-cli",
      model,
      ask: (input) => askClaudeCli({
        model,
        systemPrompt: input.systemPrompt,
        messages: input.messages,
        signal: input.signal,
      }),
    };
  }
  const model = ai.ollamaModel || "qwen2.5-coder:7b";
  return {
    name: "ollama",
    model,
    ask: (input) => askOllama({
      baseUrl: ai.ollamaUrl || "http://localhost:11434",
      model,
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      maxTokens: input.maxTokens ?? maxTokens,
      signal: input.signal,
      keepAlive: ai.ollamaKeepAlive ?? "0",
    }),
  };
}
