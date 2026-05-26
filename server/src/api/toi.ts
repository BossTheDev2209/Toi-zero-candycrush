import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { toiSubmissionRepo } from "../db/repo/toi_submissions";
import { submitToToi } from "../toi/submit";

const SubmitZ = z.object({
  language: z.enum(["c", "cpp"]),
  code: z.string(),
});

export function toiRouter(db: Database, cfg: AppConfig) {
  const r = new Hono();
  const repo = toiSubmissionRepo(db);

  r.post("/:problemId/submit", async (c) => {
    const id = Number(c.req.param("problemId"));
    const body = SubmitZ.parse(await c.req.json());

    if (!cfg.toi.submitUrl || !cfg.toi.cookie) {
      return c.json({ error: "TOI not configured. Run the Chrome RE step first." }, 400);
    }

    const result = await submitToToi({
      submitUrl: cfg.toi.submitUrl,
      cookie: cfg.toi.cookie,
      extraHeaders: cfg.toi.extraHeaders,
      problemSlugId: String(id),
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
