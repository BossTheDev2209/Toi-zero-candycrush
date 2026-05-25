import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Language, CompilerConfig } from "./verdicts";

export interface CompileInput {
  language: Language;
  code: string;
  workdir: string;
  config?: { c: CompilerConfig; cpp: CompilerConfig };
}

export interface CompileOk {
  ok: true;
  binaryPath: string;
  stderr: string;
}

export interface CompileFail {
  ok: false;
  stderr: string;
}

const DEFAULTS: { c: CompilerConfig; cpp: CompilerConfig } = {
  c:   { bin: "gcc", flags: ["-O2", "-std=c11",   "-Wall", "-Wextra", "-static"] },
  cpp: { bin: "g++", flags: ["-O2", "-std=c++17", "-Wall", "-Wextra", "-static"] },
};

export async function compile(input: CompileInput): Promise<CompileOk | CompileFail> {
  const cfg = input.config ?? DEFAULTS;
  const ext = input.language === "cpp" ? "cpp" : "c";
  const srcPath = join(input.workdir, `solution.${ext}`);
  const binName = process.platform === "win32" ? "solution.exe" : "solution";
  const binaryPath = join(input.workdir, binName);

  await writeFile(srcPath, input.code, "utf8");

  const { bin, flags } = cfg[input.language];
  const args = [...flags, srcPath, "-o", binaryPath];

  return new Promise((resolve) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (b) => { stderr += b.toString(); });
    proc.on("error", (err) => {
      resolve({ ok: false, stderr: `Failed to spawn ${bin}: ${err.message}` });
    });
    proc.on("close", (code) => {
      if (code === 0) resolve({ ok: true, binaryPath, stderr });
      else resolve({ ok: false, stderr });
    });
  });
}
