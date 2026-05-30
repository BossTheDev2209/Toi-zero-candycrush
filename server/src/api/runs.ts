import { Hono } from "hono";
import { z } from "zod";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join as joinPath, dirname, delimiter } from "node:path";
import type { Database } from "bun:sqlite";
import type { UpgradeWebSocket } from "hono/ws";
import type { AppConfig } from "../config";
import { problemRepo } from "../db/repo/problems";
import { runRepo } from "../db/repo/runs";
import { runJudge, runCustom } from "../judge/runJudge";
import { makeWorkdir, cleanupWorkdir } from "../judge/workdir";
import type { Language } from "../judge/verdicts";

const RunZ = z.object({
  language: z.enum(["c", "cpp", "py"]),
  code: z.string(),
  scope: z.enum(["sample", "all"]).default("sample"),
});

const ExecZ = z.object({
  language: z.enum(["c", "cpp", "py"]),
  code: z.string(),
  input: z.string().default(""),
});

export function runsRouter(db: Database, cfg?: AppConfig, upgradeWebSocket?: UpgradeWebSocket) {
  const r = new Hono();
  const pRepo = problemRepo(db);
  const rRepo = runRepo(db);

  r.post("/:problemId/run", async (c) => {
    const id = Number(c.req.param("problemId"));
    const p = pRepo.getById(id);
    if (!p) return c.json({ error: "not found" }, 404);
    const body = RunZ.parse(await c.req.json());
    const tests = pRepo.getTests(id);
    const judgeTests = (body.scope === "all" ? [...tests.samples, ...tests.extras] : tests.samples)
      .map((t, i) => ({ idx: i, input: t.input_text, expected: t.expected_text, subtask: t.subtask }));

    const result = await runJudge({
      language: body.language,
      code: body.code,
      timeLimitMs: p.time_limit_ms,
      ioMode: p.io_mode,
      tests: judgeTests,
      config: cfg?.compiler,
    });

    rRepo.create({
      problemId: id,
      language: body.language,
      codeSnapshot: body.code,
      verdict: result.verdict,
      totalRuntimeMs: result.totalRuntimeMs,
      perTest: result.perTest.map((t) => ({
        idx: t.idx, verdict: t.verdict, runtimeMs: t.runtimeMs, stderr: t.stderr, diff: t.diff,
      })),
    });

    return c.json(result);
  });

  // Scratch terminal: compile + run the current editor code against a single
  // hand-entered stdin, return raw output. Not graded, not persisted to history.
  r.post("/:problemId/exec", async (c) => {
    const id = Number(c.req.param("problemId"));
    const p = pRepo.getById(id);
    if (!p) return c.json({ error: "not found" }, 404);
    const body = ExecZ.parse(await c.req.json());
    const result = await runCustom({
      language: body.language,
      code: body.code,
      timeLimitMs: p.time_limit_ms,
      ioMode: p.io_mode,
      stdin: body.input,
      config: cfg?.compiler,
    });
    return c.json(result);
  });

  r.get("/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    return c.json(rRepo.listRecent(id, 10));
  });

  /**
   * Real shell terminal over WebSocket. Spawns the system shell (cmd.exe on
   * Windows, $SHELL/bash elsewhere) with piped stdio in a scratch workdir and
   * pipes raw bytes both ways — a genuine terminal you can type into. The current
   * editor code is written to solution.<ext> in that dir and the configured
   * compiler's bin dir is prepended to PATH, so you can compile + run your
   * solution right there (or hit "Run code", which types the command for you).
   * The client (xterm.js) handles local echo / line editing.
   *
   * A true PTY (node-pty) isn't usable here — it crashes under Bun on Windows —
   * so this is a piped shell: prompts, command execution and program I/O all
   * work; in-shell line history / tab-completion do not.
   *
   * Wire protocol (JSON per frame):
   *   client → { type:"start", language, code } | { type:"input", data }
   *          | { type:"run", language, code }
   *   server → { type:"data", data } | { type:"exit", code }
   *
   * One shell per socket; "start" (re)spawns. The shell dies on socket close.
   */
  if (upgradeWebSocket) {
    const EXT: Record<Language, string> = { c: "c", cpp: "cpp", py: "py" };

    r.get("/:problemId/terminal", upgradeWebSocket(() => {
      let child: ChildProcessWithoutNullStreams | null = null;
      let wd: string | null = null;

      const send = (ws: { send: (d: string) => void }, obj: unknown) => {
        try { ws.send(JSON.stringify(obj)); } catch { /* socket closed */ }
      };

      async function disposeWorkdir() {
        if (wd) { const w = wd; wd = null; try { await cleanupWorkdir(w); } catch { /* ignore */ } }
      }
      async function cleanup() {
        if (child) { try { child.kill("SIGKILL"); } catch { /* ignore */ } child = null; }
        await disposeWorkdir();
      }

      // Build the shell PATH: the workdir first (so the compiled binary runs as
      // a bare `sol.exe` — Windows doesn't search the cwd for executables by
      // default, which made `&& sol.exe` fail with errorlevel 9009), then the
      // configured compiler bin dirs (so bare g++/gcc/python resolve), then the
      // inherited PATH.
      function shellEnv(workdir: string): NodeJS.ProcessEnv {
        const dirs: string[] = [workdir];
        for (const key of ["c", "cpp", "py"] as const) {
          const bin = cfg?.compiler?.[key]?.bin;
          if (bin && (bin.includes("/") || bin.includes("\\"))) dirs.push(dirname(bin));
        }
        return { ...process.env, PATH: `${dirs.join(delimiter)}${delimiter}${process.env.PATH ?? ""}` };
      }

      function runCommand(language: Language): string {
        const ext = EXT[language];
        if (language === "py") {
          const bin = cfg?.compiler?.py?.bin || "python";
          return `"${bin}" solution.${ext}`;
        }
        const bin = cfg?.compiler?.[language]?.bin || (language === "c" ? "gcc" : "g++");
        const flags = (cfg?.compiler?.[language]?.flags ?? []).join(" ");
        const exe = process.platform === "win32" ? "sol.exe" : "sol";
        // The binary lives in the workdir, which is on PATH (see shellEnv), so a
        // bare name runs it on every platform.
        return `"${bin}" ${flags} solution.${ext} -o ${exe} && ${exe}`;
      }

      async function writeSolution(language: Language, code: string) {
        if (!wd) return;
        try { await writeFile(joinPath(wd, `solution.${EXT[language]}`), code ?? "", "utf8"); } catch { /* ignore */ }
      }

      async function start(ws: { send: (d: string) => void }, language: Language, code: string) {
        await cleanup();
        wd = await makeWorkdir();
        await writeSolution(language, code);
        const isWin = process.platform === "win32";
        const shell = isWin ? (process.env.ComSpec || "cmd.exe") : (process.env.SHELL || "/bin/bash");
        const args = isWin ? ["/Q", "/K"] : ["-i"];
        try {
          child = spawn(shell, args, { cwd: wd, stdio: ["pipe", "pipe", "pipe"], env: shellEnv(wd), windowsHide: true });
        } catch (e: any) {
          send(ws, { type: "data", data: `\r\n[failed to start shell: ${e?.message ?? e}]\r\n` });
          return;
        }
        send(ws, { type: "data", data: `\x1b[2m# real shell — your code is saved as solution.${EXT[language]}. Click "Run code" or compile manually.\x1b[0m\r\n` });
        child.stdout.on("data", (b: Buffer) => send(ws, { type: "data", data: b.toString() }));
        child.stderr.on("data", (b: Buffer) => send(ws, { type: "data", data: b.toString() }));
        child.on("error", (e: Error) => send(ws, { type: "data", data: `\r\n[shell error: ${e.message}]\r\n` }));
        child.on("close", (code: number | null) => { send(ws, { type: "exit", code }); child = null; void disposeWorkdir(); });
      }

      return {
        onMessage(evt, ws) {
          let msg: { type?: string; language?: string; code?: string; data?: string };
          try { msg = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data)); } catch { return; }
          const lang = (["c", "cpp", "py"].includes(msg.language ?? "") ? msg.language : "cpp") as Language;
          if (msg.type === "start") {
            void start(ws, lang, msg.code ?? "");
          } else if (msg.type === "input") {
            try { child?.stdin.write(msg.data ?? ""); } catch { /* not running */ }
          } else if (msg.type === "run") {
            void (async () => {
              await writeSolution(lang, msg.code ?? "");
              try { child?.stdin.write(runCommand(lang) + "\r\n"); } catch { /* not running */ }
            })();
          }
        },
        onClose() { void cleanup(); },
        onError() { void cleanup(); },
      };
    }));
  }

  return r;
}
