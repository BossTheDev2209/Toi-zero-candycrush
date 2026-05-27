import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { persistToiUpdate } from "../config";
import { problemRepo } from "../db/repo/problems";
import { toiSubmissionRepo } from "../db/repo/toi_submissions";
import { submitToToi } from "../toi/submit";
import { fetchBestScore } from "../toi/scrapeScores";
import { fetchCounts } from "../toi/scrapeCounts";
import { loginToToi } from "../toi/login";

const SubmitZ = z.object({
  language: z.enum(["c", "cpp", "py"]),
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

const CredentialsZ = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function toiRouter(db: Database, cfg: AppConfig) {
  const r = new Hono();
  const pRepo = problemRepo(db);

  /** Auto-refresh on cookie expiry: if username/password present, log in + persist. */
  async function refreshCookieIfPossible(): Promise<{ ok: boolean; error?: string }> {
    if (!cfg.toi.username || !cfg.toi.password) {
      return { ok: false, error: "no credentials stored — set toi.username + toi.password" };
    }
    const result = await loginToToi({
      baseUrl: cfg.toi.baseUrl,
      username: cfg.toi.username,
      password: cfg.toi.password,
    });
    if (!result.ok) return { ok: false, error: result.error };
    persistToiUpdate(cfg, {
      cookie: result.cookie,
      xsrf: result.xsrf,
      lastLoginAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  /**
   * Public auth status — never leaks the password itself. Returns whether credentials
   * are configured and when the last successful login was.
   */
  r.get("/auth-status", (c) => c.json({
    hasCredentials: Boolean(cfg.toi.username && cfg.toi.password),
    username: cfg.toi.username ?? null,
    lastLoginAt: cfg.toi.lastLoginAt ?? null,
    baseUrl: cfg.toi.baseUrl,
  }));

  /**
   * Save credentials. Body: { username, password }. Persists to settings.json, then
   * attempts an immediate login to validate. On success returns ok + lastLoginAt.
   * On failure the credentials ARE still persisted (user may have a typo to fix later).
   */
  r.post("/credentials", async (c) => {
    const body = CredentialsZ.parse(await c.req.json());
    persistToiUpdate(cfg, { username: body.username, password: body.password });
    const refresh = await refreshCookieIfPossible();
    if (!refresh.ok) return c.json({ ok: false, saved: true, error: refresh.error }, 400);
    return c.json({ ok: true, saved: true, lastLoginAt: cfg.toi.lastLoginAt });
  });

  /** Trigger an explicit re-login using stored credentials. */
  r.post("/login", async (c) => {
    const refresh = await refreshCookieIfPossible();
    if (!refresh.ok) return c.json({ ok: false, error: refresh.error }, 400);
    return c.json({ ok: true, lastLoginAt: cfg.toi.lastLoginAt });
  });
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

  r.post("/counts-bulk", async (c) => {
    // Accept a {slug: 0|1} map scraped client-side (chrome session authenticated)
    // and persist via updateCountsBySlug. No server-side TOI auth needed.
    const body = (await c.req.json()) as { counts?: Record<string, 0 | 1 | boolean> };
    if (!body?.counts || typeof body.counts !== "object") {
      return c.json({ error: "expected { counts: { slug: 0|1 } }" }, 400);
    }
    const map = new Map<string, 0 | 1>();
    for (const [slug, v] of Object.entries(body.counts)) {
      const num = v === true || v === 1 ? 1 : 0;
      map.set(slug, num as 0 | 1);
    }
    const apply = pRepo.updateCountsBySlug(map);
    return c.json({
      ok: true,
      seen: map.size,
      updated: apply.updated,
      notFoundInDb: apply.notFound,
      uncounted: [...map.values()].filter((v) => v === 0).length,
    });
  });

  r.post("/sync-counts", async (c) => {
    if (!cfg.toi.baseUrl) {
      return c.json({ error: "TOI not configured. Set toi.baseUrl in settings.json." }, 400);
    }
    const tryOnce = () => fetchCounts({
      baseUrl: cfg.toi.baseUrl,
      cookie: cfg.toi.cookie,
      xsrf: cfg.toi.xsrf,
      extraHeaders: cfg.toi.extraHeaders,
    });
    let result = await tryOnce();
    let refreshed = false;
    if (!result.ok && result.error.includes("cookie expired")) {
      const refresh = await refreshCookieIfPossible();
      if (refresh.ok) { refreshed = true; result = await tryOnce(); }
    }
    if (!result.ok) return c.json({ ok: false, error: result.error, refreshed }, 502);
    const apply = pRepo.updateCountsBySlug(result.counts);
    return c.json({
      ok: true,
      refreshed,
      seen: result.counts.size,
      updated: apply.updated,
      notFoundInDb: apply.notFound,
      uncounted: [...result.counts.entries()].filter(([, v]) => v === 0).length,
    });
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

    // Kick off a one-shot counts sync in parallel with score sync. Failures here
    // are non-fatal — the score sync still proceeds and the counts can be retried.
    void fetchCounts({
      baseUrl: cfg.toi.baseUrl,
      cookie: cfg.toi.cookie,
      xsrf: cfg.toi.xsrf,
      extraHeaders: cfg.toi.extraHeaders,
    }).then((countsResult) => {
      if (countsResult.ok) pRepo.updateCountsBySlug(countsResult.counts);
    });

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
