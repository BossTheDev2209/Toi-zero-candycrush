import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Language, CompilerConfig } from "./verdicts";

export interface CompileInput {
  language: Language;
  code: string;
  workdir: string;
  config?: Partial<Record<Language, CompilerConfig>>;
}

export interface CompileOk {
  ok: true;
  binaryPath: string;
  args: string[];
  stderr: string;
}

export interface CompileFail {
  ok: false;
  stderr: string;
}

const DEFAULTS: Record<Language, CompilerConfig> = {
  c:   { bin: "gcc", flags: ["-O2", "-std=c11",   "-Wall", "-Wextra", "-static"] },
  cpp: { bin: "g++", flags: ["-O2", "-std=c++17", "-Wall", "-Wextra", "-static"] },
  py:  { bin: "python", flags: ["-u"] },
};

export async function compile(input: CompileInput): Promise<CompileOk | CompileFail> {
  const cfg = { ...DEFAULTS, ...(input.config ?? {}) };
  const ext = input.language === "cpp" ? "cpp" : input.language === "py" ? "py" : "c";
  const srcPath = join(input.workdir, `solution.${ext}`);
  const binName = process.platform === "win32" ? "solution.exe" : "solution";
  const binaryPath = join(input.workdir, binName);

  await writeFile(srcPath, input.code, "utf8");

  const { bin, flags } = cfg[input.language];
  if (input.language === "py") {
    return new Promise((resolve) => {
      const proc = spawn(bin, ["-m", "py_compile", srcPath], { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      proc.stderr.on("data", (b) => { stderr += b.toString(); });
      proc.on("error", (err) => {
        resolve({ ok: false, stderr: `Failed to spawn ${bin}: ${err.message}` });
      });
      proc.on("close", (code) => {
        if (code === 0) resolve({ ok: true, binaryPath: bin, args: [...flags, srcPath], stderr });
        else resolve({ ok: false, stderr });
      });
    });
  }

  const args = [...flags, srcPath, "-o", binaryPath];

  return new Promise((resolve) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (b) => { stderr += b.toString(); });
    proc.on("error", (err) => {
      resolve({ ok: false, stderr: `Failed to spawn ${bin}: ${err.message}` });
    });
    proc.on("close", (code) => {
      if (code === 0) resolve({ ok: true, binaryPath, args: [], stderr });
      else resolve({ ok: false, stderr });
    });
  });
}
