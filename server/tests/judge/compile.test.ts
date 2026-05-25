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
});
