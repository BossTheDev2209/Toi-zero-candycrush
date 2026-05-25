import { spawn } from "node:child_process";

export interface ExecuteInput {
  binaryPath: string;
  stdin: string;
  timeoutMs: number;
  workdir: string;
}

export interface ExecuteResult {
  exit: number | null;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  timedOut: boolean;
}

export async function execute(input: ExecuteInput): Promise<ExecuteResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const proc = spawn(input.binaryPath, [], {
      cwd: input.workdir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, input.timeoutMs);

    proc.stdout.on("data", (b) => { stdout += b.toString(); });
    proc.stderr.on("data", (b) => { stderr += b.toString(); });

    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exit: null, stdout, stderr: stderr + "\nspawn error: " + err.message,
        runtimeMs: performance.now() - start, timedOut: false,
      });
    });

    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const runtimeMs = performance.now() - start;
      // Normalize CRLF to LF for cross-platform consistency
      resolve({ exit: code, stdout: stdout.replace(/\r\n/g, "\n"), stderr: stderr.replace(/\r\n/g, "\n"), runtimeMs, timedOut });
    });

    try {
      proc.stdin.write(input.stdin);
      proc.stdin.end();
    } catch {
      // ignore — process may have already exited
    }
  });
}
