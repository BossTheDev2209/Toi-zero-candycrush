import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runJudge } from "../../src/judge/runJudge";

const FIX = join(import.meta.dir, "..", "fixtures");
const echoCode = readFileSync(join(FIX, "stdio_echo.cpp"), "utf8");
const waCode = readFileSync(join(FIX, "wa.cpp"), "utf8");
const tleCode = readFileSync(join(FIX, "tle.cpp"), "utf8");
const ceCode = readFileSync(join(FIX, "ce.cpp"), "utf8");
const fileIoCode = readFileSync(join(FIX, "file_io.cpp"), "utf8");
const pythonEchoCode = readFileSync(join(FIX, "stdio_echo.py"), "utf8");

describe("runJudge stdio mode", () => {
  test("AC across all sample tests", async () => {
    const r = await runJudge({
      language: "cpp",
      code: echoCode,
      timeLimitMs: 1000,
      ioMode: "stdio",
      tests: [
        { idx: 0, input: "hi\n",  expected: "hi\n"  },
        { idx: 1, input: "bye\n", expected: "bye\n" },
      ],
    });
    expect(r.verdict).toBe("AC");
    expect(r.perTest.every((t) => t.verdict === "AC")).toBe(true);
  });

  test("WA when output differs", async () => {
    const r = await runJudge({
      language: "cpp",
      code: waCode,
      timeLimitMs: 1000,
      ioMode: "stdio",
      tests: [{ idx: 0, input: "2 3\n", expected: "5\n" }],
    });
    expect(r.verdict).toBe("WA");
    expect(r.perTest[0]!.verdict).toBe("WA");
    expect(r.perTest[0]!.diff).toBeTruthy();
  });

  test("TLE when execution exceeds time limit", async () => {
    const r = await runJudge({
      language: "cpp",
      code: tleCode,
      timeLimitMs: 150,
      ioMode: "stdio",
      tests: [{ idx: 0, input: "", expected: "" }],
    });
    expect(r.verdict).toBe("TLE");
  });

  test("CE short-circuits — no per-test runs", async () => {
    const r = await runJudge({
      language: "cpp",
      code: ceCode,
      timeLimitMs: 1000,
      ioMode: "stdio",
      tests: [{ idx: 0, input: "", expected: "" }],
    });
    expect(r.verdict).toBe("CE");
    expect(r.compileStderr).toBeTruthy();
    expect(r.perTest.length).toBe(0);
  });

  test("runs Python solutions", async () => {
    const r = await runJudge({
      language: "py",
      code: pythonEchoCode,
      timeLimitMs: 1000,
      ioMode: "stdio",
      tests: [{ idx: 0, input: "python\n", expected: "python\n" }],
    });
    expect(r.verdict).toBe("AC");
    expect(r.perTest[0]!.verdict).toBe("AC");
  });
});

describe("runJudge file mode", () => {
  test("AC when program reads train1.in and writes train1.out", async () => {
    const r = await runJudge({
      language: "cpp",
      code: fileIoCode,
      timeLimitMs: 1000,
      ioMode: "file:train1",
      tests: [{ idx: 0, input: "4 5\n", expected: "9\n" }],
    });
    expect(r.verdict).toBe("AC");
  });
});
