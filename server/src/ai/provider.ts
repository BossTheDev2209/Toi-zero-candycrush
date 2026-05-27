import type { AppConfig } from "../config";

export type ProviderName = "anthropic" | "openai" | "ollama";

export interface AiAskInput {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}

export interface AiAskResult {
  ok: boolean;
  text: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

export interface AiProvider {
  name: ProviderName;
  model: string;
  ask(input: AiAskInput): Promise<AiAskResult>;
}

export interface AiProviderDispatcher {
  current(): AiProvider;
}

// Implemented in Task 5 once the concrete providers exist. For now, exporting
// the signatures keeps Task 4 (systemPrompt) free of provider implementation details.
export function buildProvider(_cfg: AppConfig["ai"]): AiProvider {
  throw new Error("buildProvider not implemented yet - see Task 5");
}
