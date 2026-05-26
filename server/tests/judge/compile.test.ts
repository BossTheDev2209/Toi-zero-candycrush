import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "../../src/judge/compile";
import { makeWorkdir, cleanupWorkdir } from "../../src/judge/workdir";

const FIX = join(import.meta.dir, "..", "fixtures");

describe("compile", () => {
  test("compiles a valid C++ program and reports success", async () => {
    const code = readFileSync(join(FIX, "ac.cpp"), "utf8");
    const wd = await makeWorkdir();
    try {
      const r = await compile({ language: "cpp", code, workdir: wd });
      expect(r.ok).toBe(true);
      expect(r.binaryPath).toBeTruthy();
    } finally {
      await cleanupWorkdir(wd);
    }
  });

  test("returns CE with stderr when compilation fails", async () => {
    const code = readFileSync(join(FIX, "ce.cpp"), "utf8");
    const wd = await makeWorkdir();
    try {
      const r = await compile({ language: "cpp", code, workdir: wd });
      expect(r.ok).toBe(false);
      expect(r.stderr).toContain("notdefined");
    } finally {
      await cleanupWorkdir(wd);
    }
  });

  test("accepts a valid Python program", async () => {
    const code = readFileSync(join(FIX, "stdio_echo.py"), "utf8");
    const wd = await makeWorkdir();
    try {
      const r = await compile({ language: "py", code, workdir: wd });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.args.join(" ")).toContain("solution.py");
    } finally {
      await cleanupWorkdir(wd);
    }
  });

  test("returns CE for Python syntax errors", async () => {
    const wd = await makeWorkdir();
    try {
      const r = await compile({ language: "py", code: "if True print('x')\n", workdir: wd });
      expect(r.ok).toBe(false);
      expect(r.stderr).toContain("SyntaxError");
    } finally {
      await cleanupWorkdir(wd);
    }
  });
});
