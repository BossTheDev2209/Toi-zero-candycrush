import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { problemRepo } from "../db/repo/problems";
import { runRepo } from "../db/repo/runs";
import { runJudge, runCustom } from "../judge/runJudge";

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

export function runsRouter(db: Database, cfg?: AppConfig) {
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

  return r;
}
