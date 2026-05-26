import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { problemRepo } from "../db/repo/problems";
import { hasPdf } from "../db/repo/pdfCache";

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
  slug: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/),
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
const ProgressFlagsZ = z.object({
  toiPreviousYear: z.boolean(),
  toiPreviousYearNote: z.string().max(240).default(""),
});

export function problemsRouter(db: Database, problemsDir?: string) {
  const r = new Hono();
  const repo = problemRepo(db);
  const runCount = db.prepare("SELECT COUNT(*) AS count FROM run WHERE problem_id = ?");
  const withPdf = <T extends { slug: string }>(problem: T) => ({
    ...problem,
    has_pdf: problemsDir ? hasPdf(problemsDir, problem.slug) : false,
    local_run_count: Number((runCount.get((problem as T & { id: number }).id) as { count: number } | undefined)?.count ?? 0),
  });

  r.get("/", (c) => c.json(repo.listAll().map(withPdf)));

  r.get("/:id", (c) => {
    const id = Number(c.req.param("id"));
    const p = repo.getById(id);
    if (!p) return c.json({ error: "not found" }, 404);
    return c.json({ ...withPdf(p), tests: repo.getTests(id) });
  });

  r.post("/", async (c) => {
    const body = ProblemZ.parse(await c.req.json());
    const id = repo.create(body);
    return c.json({ id }, 201);
  });

  r.post("/bulk", async (c) => {
    const body = z.array(ProblemZ).parse(await c.req.json());
    const existing = new Set(repo.listAll().map((p) => p.slug));
    let created = 0; let skipped = 0;
    for (const p of body) {
      if (existing.has(p.slug)) { skipped += 1; continue; }
      repo.create(p);
      created += 1;
    }
    return c.json({ created, skipped, total: body.length });
  });

  r.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = ProblemZ.parse(await c.req.json());
    const ok = repo.update(id, body);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  r.patch("/:id/progress-flags", async (c) => {
    const id = Number(c.req.param("id"));
    const body = ProgressFlagsZ.parse(await c.req.json());
    const ok = repo.updateProgressFlags(id, body);
    if (!ok) return c.json({ error: "not found" }, 404);
    const p = repo.getById(id);
    return c.json({ ok: true, problem: p ? withPdf(p) : null });
  });

  r.delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    const ok = repo.delete(id);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  return r;
}
