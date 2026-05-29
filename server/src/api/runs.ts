import { Hono } from "hono";
import { z } from "zod";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { Database } from "bun:sqlite";
import type { UpgradeWebSocket } from "hono/ws";
import type { AppConfig } from "../config";
import { problemRepo } from "../db/repo/problems";
import { runRepo } from "../db/repo/runs";
import { runJudge, runCustom } from "../judge/runJudge";
import { compile } from "../judge/compile";
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
   * Interactive terminal over WebSocket. Unlike /exec (compile + one fixed
   * stdin + buffered result), this keeps the process alive so the user can type
   * stdin live and watch stdout/stderr stream in real time — a real REPL-ish
   * console for the current editor code.
   *
   * Wire protocol (JSON per frame):
   *   client → { type: "start", language, code } | { type: "stdin", data }
   *          | { type: "eof" } | { type: "kill" }
   *   server → { type: "system"|"compile-error"|"stdout"|"stderr", data }
   *          | { type: "started" } | { type: "exit", code, runtimeMs }
   *
   * Only one process per socket; a new "start" restarts. Uses stdio (file-IO
   * problems still grade via Run; the terminal is for eyeballing stdio runs).
   * Safety: 120s wall-clock cap, and the process dies on socket close.
   */
  if (upgradeWebSocket) {
    r.get("/:problemId/terminal", upgradeWebSocket((c) => {
      const id = Number(c.req.param("problemId"));
      let child: ChildProcessWithoutNullStreams | null = null;
      let wd: string | null = null;
      let killTimer: ReturnType<typeof setTimeout> | null = null;
      let startedAt = 0;

      const send = (ws: { send: (d: string) => void }, obj: unknown) => {
        try { ws.send(JSON.stringify(obj)); } catch { /* socket closed */ }
      };

      async function disposeWorkdir() {
        if (wd) { const w = wd; wd = null; try { await cleanupWorkdir(w); } catch { /* ignore */ } }
      }
      async function cleanup() {
        if (killTimer) { clearTimeout(killTimer); killTimer = null; }
        if (child) { try { child.kill("SIGKILL"); } catch { /* ignore */ } child = null; }
        await disposeWorkdir();
      }

      async function start(ws: { send: (d: string) => void }, language: Language, code: string) {
        await cleanup();
        const p = pRepo.getById(id);
        if (!p) { send(ws, { type: "system", data: "problem not found" }); return; }
        wd = await makeWorkdir();
        send(ws, { type: "system", data: "Compiling…" });
        const cc = await compile({ language, code, workdir: wd, config: cfg?.compiler });
        if (!cc.ok) {
          send(ws, { type: "compile-error", data: cc.stderr });
          send(ws, { type: "exit", code: null, runtimeMs: 0 });
          await disposeWorkdir();
          return;
        }
        send(ws, { type: "started" });
        startedAt = performance.now();
        child = spawn(cc.binaryPath, cc.args ?? [], { cwd: wd, stdio: ["pipe", "pipe", "pipe"] });
        child.stdout.on("data", (b: Buffer) => send(ws, { type: "stdout", data: b.toString() }));
        child.stderr.on("data", (b: Buffer) => send(ws, { type: "stderr", data: b.toString() }));
        child.on("error", (e: Error) => send(ws, { type: "stderr", data: `spawn error: ${e.message}` }));
        child.on("close", (code: number | null) => {
          const runtimeMs = Math.round(performance.now() - startedAt);
          send(ws, { type: "exit", code, runtimeMs });
          if (killTimer) { clearTimeout(killTimer); killTimer = null; }
          child = null;
          void disposeWorkdir();
        });
        killTimer = setTimeout(() => {
          if (child) {
            send(ws, { type: "system", data: "Killed: 120s wall-clock limit." });
            try { child.kill("SIGKILL"); } catch { /* ignore */ }
          }
        }, 120_000);
      }

      return {
        onMessage(evt, ws) {
          let msg: { type?: string; language?: string; code?: string; data?: string };
          try {
            const raw = typeof evt.data === "string" ? evt.data : String(evt.data);
            msg = JSON.parse(raw);
          } catch { return; }
          if (msg.type === "start") {
            const lang = (["c", "cpp", "py"].includes(msg.language ?? "") ? msg.language : "cpp") as Language;
            void start(ws, lang, msg.code ?? "");
          } else if (msg.type === "stdin") {
            try { child?.stdin.write(msg.data ?? ""); } catch { /* not running */ }
          } else if (msg.type === "eof") {
            try { child?.stdin.end(); } catch { /* not running */ }
          } else if (msg.type === "kill") {
            void cleanup();
            send(ws, { type: "system", data: "Stopped." });
          }
        },
        onClose() { void cleanup(); },
        onError() { void cleanup(); },
      };
    }));
  }

  return r;
}
