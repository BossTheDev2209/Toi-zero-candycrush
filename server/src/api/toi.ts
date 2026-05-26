import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { problemRepo } from "../db/repo/problems";
import { toiSubmissionRepo } from "../db/repo/toi_submissions";
import { submitToToi } from "../toi/submit";

const SubmitZ = z.object({
  language: z.enum(["c", "cpp"]),
  code: z.string(),
});

export function toiRouter(db: Database, cfg: AppConfig) {
  const r = new Hono();
  const pRepo = problemRepo(db);
  const repo = toiSubmissionRepo(db);

  r.post("/:problemId/submit", async (c) => {
    const id = Number(c.req.param("problemId"));
    const body = SubmitZ.parse(await c.req.json());

    const problem = pRepo.getById(id);
    if (!problem) return c.json({ error: "problem not found" }, 404);

    if (!cfg.toi.baseUrl || !cfg.toi.cookie || !cfg.toi.xsrf) {
      return c.json({
        error: "TOI not configured. Set toi.baseUrl, toi.cookie, toi.xsrf in settings.json.",
      }, 400);
    }

    const result = await submitToToi({
      baseUrl: cfg.toi.baseUrl,
      cookie: cfg.toi.cookie,
      xsrf: cfg.toi.xsrf,
      extraHeaders: cfg.toi.extraHeaders,
      slug: problem.slug,
      language: body.language,
      code: body.code,
    });

    repo.create({
      problemId: id,
      language: body.language,
      codeSnapshot: body.code,
      httpStatus: result.status,
      responseJson: JSON.stringify(result.body ?? null),
      error: result.error,
    });

    return c.json(result);
  });

  return r;
}
