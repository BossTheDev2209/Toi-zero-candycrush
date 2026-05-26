import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { problemRepo } from "../db/repo/problems";

const TestZ = z.object({
  input: z.string(),
  expected: z.string(),
  explanationMd: z.string().default(""),
});
const ExtraTestZ = z.object({
  input: z.string(),
  expected: z.string(),
  subtask: z.string().default("main"),
});
const ProblemZ = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1),
  statementMd: z.string().default(""),
  inputMd: z.string().default(""),
  outputMd: z.string().default(""),
  category: z.string().default("general"),
  timeLimitMs: z.number().int().positive().default(1000),
  memoryLimitMb: z.number().int().positive().default(256),
  ioMode: z.string().default("stdio"),
  sourceUrl: z.string().default(""),
  sampleTests: z.array(TestZ).default([]),
  extraTests: z.array(ExtraTestZ).default([]),
});

export function problemsRouter(db: Database) {
  const r = new Hono();
  const repo = problemRepo(db);

  r.get("/", (c) => c.json(repo.listAll()));

  r.get("/:id", (c) => {
    const id = Number(c.req.param("id"));
    const p = repo.getById(id);
    if (!p) return c.json({ error: "not found" }, 404);
    return c.json({ ...p, tests: repo.getTests(id) });
  });

  r.post("/", async (c) => {
    const body = ProblemZ.parse(await c.req.json());
    const id = repo.create(body);
    return c.json({ id }, 201);
  });

  r.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = ProblemZ.parse(await c.req.json());
    const ok = repo.update(id, body);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  r.delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    const ok = repo.delete(id);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  return r;
}
