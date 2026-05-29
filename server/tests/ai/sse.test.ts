import { describe, expect, test } from "bun:test";
import { readSseData } from "../../src/ai/sse";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

async function collect(s: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const d of readSseData(s)) out.push(d);
  return out;
}

describe("readSseData", () => {
  test("yields data payloads and skips comment / event lines", async () => {
    const out = await collect(streamOf([
      "event: delta\ndata: {\"a\":1}\n\n",
      ": keep-alive comment\n",
      "event: done\ndata: {\"b\":2}\n\n",
    ]));
    expect(out).toEqual(['{"a":1}', '{"b":2}']);
  });

  test("reassembles a payload split across read chunks", async () => {
    const out = await collect(streamOf(["data: hel", "lo wor", "ld\n\n"]));
    expect(out).toEqual(["hello world"]);
  });

  test("flushes a trailing data line with no terminating newline", async () => {
    const out = await collect(streamOf(["data: tail"]));
    expect(out).toEqual(["tail"]);
  });
});
