import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { persistToiUpdate } from "../config";
import { problemRepo } from "../db/repo/problems";
import { solutionRepo } from "../db/repo/solutions";
import { toiSubmissionRepo } from "../db/repo/toi_submissions";
import { submitToToi } from "../toi/submit";
import { fetchBestScore } from "../toi/scrapeScores";
import { fetchCounts } from "../toi/scrapeCounts";
import { loginToToi } from "../toi/login";
import { refreshXsrfFromContest } from "../toi/refreshXsrf";

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

interface SubmitAllProgress {
  running: boolean;
  total: number;
  done: number;
  succeeded: number;
  failed: { slug: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
}

let submitAllProgress: SubmitAllProgress = {
  running: false,
  total: 0,
  done: 0,
  succeeded: 0,
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
  const sRepo = solutionRepo(db);
  const subRepo = toiSubmissionRepo(db);

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
   * Cheap recovery for submits that fail with stale _xsrf (HTTP 403 from CMS).
   * GETs the contest landing with the current login cookie, picks up the fresh
   * `_xsrf` from Set-Cookie, persists if changed. Falls back to a full re-login
   * only if the xsrf refresh itself fails — that's when the login cookie is also
   * expired and we need to roll the whole session.
   */
  async function recoverFromXsrf403(): Promise<{ ok: boolean; refreshed: "xsrf" | "login" | null; error?: string }> {
    const xsrfRefresh = await refreshXsrfFromContest({
      baseUrl: cfg.toi.baseUrl,
      cookie: cfg.toi.cookie,
      oldXsrf: cfg.toi.xsrf,
      extraHeaders: cfg.toi.extraHeaders,
    });
    if (xsrfRefresh.ok) {
      if (xsrfRefresh.changed) persistToiUpdate(cfg, { xsrf: xsrfRefresh.xsrf });
      return { ok: true, refreshed: xsrfRefresh.changed ? "xsrf" : null };
    }
    const reLogin = await refreshCookieIfPossible();
    if (reLogin.ok) return { ok: true, refreshed: "login" };
    return { ok: false, refreshed: null, error: reLogin.error ?? xsrfRefresh.error };
  }

  /** A submit error string is "auth-flavored" (stale xsrf, expired cookie, login redirect) if any of these substrings show up. */
  function isAuthError(err: string | null | undefined): boolean {
    if (!err) return false;
    return /xsrf|cookie|login|HTTP 403/i.test(err);
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

    const trySubmit = () => submitToToi({
      baseUrl: cfg.toi.baseUrl,
      cookie: cfg.toi.cookie,
      xsrf: cfg.toi.xsrf,
      extraHeaders: cfg.toi.extraHeaders,
      slug: problem.slug,
      language: body.language,
      code: body.code,
    });

    let result = await trySubmit();
    let recovery: string | null = null;
    // Auto-recover on stale-xsrf / cookie-expired (HTTP 403, login redirect, etc.)
    // Single retry — if the second attempt still fails, return the error to the user.
    if (isAuthError(result.error)) {
      const refresh = await recoverFromXsrf403();
      if (refresh.ok) {
        recovery = refresh.refreshed; // "xsrf" | "login" | null
        result = await trySubmit();
      }
    }

    subRepo.create({
      problemId: id,
      language: body.language,
      codeSnapshot: body.code,
      httpStatus: result.status,
      responseJson: JSON.stringify(result.body ?? null),
      error: result.error,
    });

    return c.json({ ...result, recovery });
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

  r.post("/sync-scores", async (c) => {
    if (syncProgress.running) return c.json(syncProgress, 409);
    if (cfg.toi.baseUrl && (!cfg.toi.cookie || !cfg.toi.xsrf) && cfg.toi.username && cfg.toi.password) {
      const refresh = await refreshCookieIfPossible();
      if (!refresh.ok) {
        return c.json({ error: refresh.error ?? "TOI login failed. Check username/password in settings." }, 400);
      }
    }
    if (!cfg.toi.baseUrl || !cfg.toi.cookie || !cfg.toi.xsrf) {
      return c.json({
        error: "TOI not configured. Save TOI credentials in Settings, or set toi.baseUrl, toi.cookie, toi.xsrf in settings.json.",
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

  /**
   * Bulk-submit every problem with a saved local solution to TOI.
   * Returns 202 immediately and runs in background; poll /submit-all-progress.
   * Concurrency capped at 3 to avoid rate-limiting / cookie invalidation.
   * Stops the whole batch on cookie expiry (single auto-refresh attempt allowed).
   */
  r.post("/submit-all", async (c) => {
    if (submitAllProgress.running) return c.json(submitAllProgress, 409);
    if (!cfg.toi.baseUrl || !cfg.toi.cookie || !cfg.toi.xsrf) {
      return c.json({ error: "TOI not configured. Set toi.baseUrl, toi.cookie, toi.xsrf in settings.json." }, 400);
    }

    const solutions = sRepo.listAllNonEmpty();
    const targets: { problemId: number; slug: string; language: "c" | "cpp" | "py"; code: string }[] = [];
    for (const s of solutions) {
      const p = pRepo.getById(s.problem_id);
      if (!p) continue;
      targets.push({ problemId: s.problem_id, slug: p.slug, language: s.language, code: s.code });
    }

    submitAllProgress = {
      running: true,
      total: targets.length,
      done: 0,
      succeeded: 0,
      failed: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    void runWithConcurrency(targets, 3, async (t) => {
      const trySubmit = () => submitToToi({
        baseUrl: cfg.toi.baseUrl,
        cookie: cfg.toi.cookie,
        xsrf: cfg.toi.xsrf,
        extraHeaders: cfg.toi.extraHeaders,
        slug: t.slug,
        language: t.language,
        code: t.code,
      });
      let result = await trySubmit();
      if (isAuthError(result.error)) {
        // Prefer the cheap xsrf refresh first; recoverFromXsrf403 falls back to a
        // full re-login internally if the xsrf refresh fails. Single retry.
        const refresh = await recoverFromXsrf403();
        if (refresh.ok) result = await trySubmit();
      }
      subRepo.create({
        problemId: t.problemId,
        language: t.language,
        codeSnapshot: t.code,
        httpStatus: result.status,
        responseJson: JSON.stringify(result.body ?? null),
        error: result.error,
      });
      if (result.status && result.status >= 200 && result.status < 400 && !result.error) {
        submitAllProgress.succeeded += 1;
      } else {
        submitAllProgress.failed.push({ slug: t.slug, error: result.error ?? `HTTP ${result.status}` });
      }
      submitAllProgress.done += 1;
    }).finally(() => {
      submitAllProgress.running = false;
      submitAllProgress.finishedAt = new Date().toISOString();
    });

    return c.json(submitAllProgress, 202);
  });

  r.get("/submit-all-progress", (c) => c.json(submitAllProgress));

  return r;
}
