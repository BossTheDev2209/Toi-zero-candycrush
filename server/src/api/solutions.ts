import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { solutionRepo } from "../db/repo/solutions";

const SaveZ = z.object({
  language: z.enum(["c", "cpp"]),
  code: z.string(),
});

export function solutionsRouter(db: Database) {
  const r = new Hono();
  const repo = solutionRepo(db);

  r.get("/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    return c.json(repo.get(id) ?? null);
  });

  r.put("/:problemId", async (c) => {
    const id = Number(c.req.param("problemId"));
    const body = SaveZ.parse(await c.req.json());
    repo.upsert(id, body.language, body.code);
    return c.json({ ok: true });
  });

  return r;
}
