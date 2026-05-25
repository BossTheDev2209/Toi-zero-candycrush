import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "../../src/judge/compile";
import { execute } from "../../src/judge/execute";
import { makeWorkdir, cleanupWorkdir } from "../../src/judge/workdir";

const FIX = join(import.meta.dir, "..", "fixtures");

async function build(filename: string) {
  const wd = await makeWorkdir();
  const code = readFileSync(join(FIX, filename), "utf8");
  const r = await compile({ language: "cpp", code, workdir: wd });
  if (!r.ok) throw new Error("compile failed: " + r.stderr);
  return { wd, bin: r.binaryPath };
}

describe("execute", () => {
  test("captures stdout on a normal run", async () => {
    const { wd, bin } = await build("stdio_echo.cpp");
    try {
      const r = await execute({ binaryPath: bin, stdin: "hello\nworld\n", timeoutMs: 1000, workdir: wd });
      expect(r.exit).toBe(0);
      expect(r.stdout).toBe("hello\nworld\n");
      expect(r.timedOut).toBe(false);
    } finally {
      await cleanupWorkdir(wd);
    }
  });

  test("kills the process after timeoutMs and reports timedOut", async () => {
    const { wd, bin } = await build("tle.cpp");
    try {
      const r = await execute({ binaryPath: bin, stdin: "", timeoutMs: 200, workdir: wd });
      expect(r.timedOut).toBe(true);
      expect(r.runtimeMs).toBeGreaterThanOrEqual(200);
    } finally {
      await cleanupWorkdir(wd);
    }
  });

  test("captures non-zero exit on runtime error", async () => {
    const { wd, bin } = await build("re.cpp");
    try {
      const r = await execute({ binaryPath: bin, stdin: "", timeoutMs: 1000, workdir: wd });
      expect(r.timedOut).toBe(false);
      expect(r.exit).not.toBe(0);
    } finally {
      await cleanupWorkdir(wd);
    }
  });
});
