import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { problemRepo } from "../db/repo/problems";
import { toiSubmissionRepo } from "../db/repo/toi_submissions";
import { submitToToi } from "../toi/submit";
import { fetchBestScore } from "../toi/scrapeScores";

const SubmitZ = z.object({
  language: z.enum(["c", "cpp"]),
  code: z.string(),
});

interface SyncProgress {
  running: boolean;
  total: number;
  done: number;
  updated: number;
  failed: { slug: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
}

let syncProgress: SyncProgress = {
  running: false,
  total: 0,
  done: 0,
  updated: 0,
  failed: [],
  startedAt: null,
  finishedAt: null,
};

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next]!;
      next += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

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

  r.post("/sync-scores", (c) => {
    if (syncProgress.running) return c.json(syncProgress, 409);
    if (!cfg.toi.baseUrl || !cfg.toi.cookie || !cfg.toi.xsrf) {
      return c.json({
        error: "TOI not configured. Set toi.baseUrl, toi.cookie, toi.xsrf in settings.json.",
      }, 400);
    }

    const problems = pRepo.listAll();
    syncProgress = {
      running: true,
      total: problems.length,
      done: 0,
      updated: 0,
      failed: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    void runWithConcurrency(problems, 8, async (problem) => {
      const result = await fetchBestScore({
        baseUrl: cfg.toi.baseUrl,
        cookie: cfg.toi.cookie,
        xsrf: cfg.toi.xsrf,
        extraHeaders: cfg.toi.extraHeaders,
        slug: problem.slug,
      });
      if (result.ok) {
        if (pRepo.updateToiScore(problem.id, result.score, new Date().toISOString())) {
          syncProgress.updated += 1;
        }
      } else {
        syncProgress.failed.push({ slug: problem.slug, error: result.error });
      }
      syncProgress.done += 1;
    }).finally(() => {
      syncProgress.running = false;
      syncProgress.finishedAt = new Date().toISOString();
    });

    return c.json(syncProgress, 202);
  });

  r.get("/sync-progress", (c) => c.json(syncProgress));

  return r;
}
