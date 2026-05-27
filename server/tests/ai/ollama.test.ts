import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { askOllama } from "../../src/ai/ollama";

const realFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      message: { role: "assistant", content: "Hello from mock Ollama." },
      prompt_eval_count: 42,
      eval_count: 17,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => { globalThis.fetch = realFetch; });

describe("askOllama", () => {
  test("posts to /api/chat with system + messages and parses content", async () => {
    const result = await askOllama({
      baseUrl: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a tutor.",
      messages: [{ role: "user", content: "help" }],
      maxTokens: 1024,
    });
    expect(result.ok).toBe(true);
    expect(result.text).toBe("Hello from mock Ollama.");
    expect(result.tokensIn).toBe(42);
    expect(result.tokensOut).toBe(17);
    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.model).toBe("qwen2.5-coder:7b");
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a tutor." });
    expect(body.messages[1]).toEqual({ role: "user", content: "help" });
    expect(body.stream).toBe(false);
  });

  test("returns ok: false with error message when fetch throws", async () => {
    globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
    const result = await askOllama({
      baseUrl: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      systemPrompt: "x", messages: [], maxTokens: 1024,
    });
    expect(result.ok).toBe(false);
    expect(result.text).toBe("");
    expect(result.error).toContain("ECONNREFUSED");
  });
});
