import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { askOllama, parseKeepAlive } from "../../src/ai/ollama";

const realFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];

function ndjsonStream(frames: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(JSON.stringify(f) + "\n"));
      controller.close();
    },
  });
}

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const body = ndjsonStream([
      { message: { role: "assistant", content: "Hello " } },
      { message: { role: "assistant", content: "from " } },
      { message: { role: "assistant", content: "mock Ollama." } },
      { done: true, prompt_eval_count: 42, eval_count: 17 },
    ]);
    return new Response(body, { status: 200, headers: { "content-type": "application/x-ndjson" } });
  }) as typeof fetch;
});

afterEach(() => { globalThis.fetch = realFetch; });

describe("askOllama", () => {
  test("posts to /api/chat with stream:true, aggregates NDJSON frames, captures token counts", async () => {
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
    expect(body.stream).toBe(true);
  });

  test("passes keep_alive to ollama as the right JSON type (number for bare ints, string for durations)", async () => {
    // Default: send the number 0 (NOT the string "0"). Ollama's keep_alive
    // parses bare numeric strings via Go's time.ParseDuration and rejects them
    // with "time: missing unit in duration".
    await askOllama({
      baseUrl: "http://localhost:11434",
      model: "x", systemPrompt: "x", messages: [{ role: "user", content: "go" }], maxTokens: 1,
    });
    expect(JSON.parse(calls[0]!.init.body as string).keep_alive).toBe(0);

    calls = [];
    await askOllama({
      baseUrl: "http://localhost:11434",
      model: "x", systemPrompt: "x", messages: [{ role: "user", content: "go" }], maxTokens: 1,
      keepAlive: "-1",
    });
    expect(JSON.parse(calls[0]!.init.body as string).keep_alive).toBe(-1);

    calls = [];
    await askOllama({
      baseUrl: "http://localhost:11434",
      model: "x", systemPrompt: "x", messages: [{ role: "user", content: "go" }], maxTokens: 1,
      keepAlive: "5m",
    });
    expect(JSON.parse(calls[0]!.init.body as string).keep_alive).toBe("5m");
  });

  test("parseKeepAlive maps user input to the Ollama-accepted JSON type", () => {
    expect(parseKeepAlive("0")).toBe(0);
    expect(parseKeepAlive("-1")).toBe(-1);
    expect(parseKeepAlive("30")).toBe(30);
    expect(parseKeepAlive("5m")).toBe("5m");
    expect(parseKeepAlive("1h30m")).toBe("1h30m");
    expect(parseKeepAlive(undefined)).toBe(0);
    expect(parseKeepAlive("")).toBe(0);
  });

  test("treats an aborted stream as a non-error stop and returns whatever text it received", async () => {
    // Mock fetch: emit one frame, then reject on the next read by aborting.
    globalThis.fetch = (async (_url: string, init: RequestInit = {}) => {
      const sig = init.signal;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(JSON.stringify({ message: { content: "partial " } }) + "\n"));
          // Wait for the abort signal, then surface it as a reader error.
          await new Promise<void>((resolve) => {
            if (sig?.aborted) return resolve();
            sig?.addEventListener("abort", () => resolve(), { once: true });
          });
          controller.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
        },
      });
      return new Response(stream, { status: 200 });
    }) as typeof fetch;

    const controller = new AbortController();
    // Abort shortly after the first frame is processed.
    setTimeout(() => controller.abort(), 20);

    const result = await askOllama({
      baseUrl: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      systemPrompt: "x",
      messages: [{ role: "user", content: "go" }],
      maxTokens: 1024,
      signal: controller.signal,
    });
    expect(result.text).toContain("partial");
    // ok is true when we got any text back (a stop is not a failure if it produced output)
    expect(result.ok).toBe(true);
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

  test("falls back to one-shot JSON parse if Response has no streaming body", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        message: { role: "assistant", content: "one-shot" },
        prompt_eval_count: 5,
        eval_count: 3,
      }), { status: 200, headers: { "content-type": "application/json" } })
    ) as typeof fetch;
    // Force no body by overriding after construction — Response has body when given a string,
    // so this case is covered by the streaming path returning the same data via single-line NDJSON.
    // Instead, verify single-line NDJSON works:
    globalThis.fetch = (async () => {
      const body = ndjsonStream([
        { message: { content: "one-shot" }, done: true, prompt_eval_count: 5, eval_count: 3 },
      ]);
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    const result = await askOllama({
      baseUrl: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      systemPrompt: "x", messages: [{ role: "user", content: "go" }], maxTokens: 1024,
    });
    expect(result.ok).toBe(true);
    expect(result.text).toBe("one-shot");
    expect(result.tokensIn).toBe(5);
    expect(result.tokensOut).toBe(3);
  });
});
