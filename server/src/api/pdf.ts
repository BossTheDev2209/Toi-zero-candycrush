import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { problemRepo } from "../db/repo/problems";
import { fetchPdf } from "../toi/fetchPdf";
import { hasPdf, readPdf, writePdfAtomic } from "../db/repo/pdfCache";

interface PdfRouterOptions {
  problemsDir: string;
}

export function pdfRouter(db: Database, cfg: AppConfig, options: PdfRouterOptions) {
  const r = new Hono();
  const repo = problemRepo(db);

  r.get("/:id/pdf", (c) => {
    const id = Number(c.req.param("id"));
    const problem = repo.getById(id);
    if (!problem) return c.json({ error: "problem not found" }, 404);
    const bytes = readPdf(options.problemsDir, problem.slug);
    if (!bytes) return c.json({ error: "pdf not found" }, 404);
    return c.body(bytes, 200, {
      "content-type": "application/pdf",
      "cache-control": "private, max-age=60",
    });
  });

  r.post("/:id/pdf/sync", async (c) => {
    const id = Number(c.req.param("id"));
    const problem = repo.getById(id);
    if (!problem) return c.json({ error: "problem not found" }, 404);
    if (!cfg.toi.baseUrl || !cfg.toi.cookie || !cfg.toi.xsrf) {
      return c.json({ error: "TOI not configured. Set toi.baseUrl, toi.cookie, toi.xsrf in settings.json." }, 400);
    }

    const result = await fetchPdf({
      baseUrl: cfg.toi.baseUrl,
      cookie: cfg.toi.cookie,
      xsrf: cfg.toi.xsrf,
      extraHeaders: cfg.toi.extraHeaders,
      slug: problem.slug,
    });
    if (!result.ok) return c.json({ ok: false, error: result.error }, 502);
    writePdfAtomic(options.problemsDir, problem.slug, result.bytes);
    return c.json({ ok: true, sizeKb: result.sizeKb });
  });

  /**
   * Bulk PDF sync as a background job with a progress endpoint, mirroring the
   * /sync-scores design. Returns 202 immediately and runs the fetches in
   * batches of 8. The UI polls /sync-pdfs-progress to show "Syncing X/Y" and
   * picks up failures at the end. Skipping the sync entirely (when all PDFs
   * already exist) still returns a finished progress object so the client can
   * surface "0 to download".
   */
  r.post("/sync-pdfs", async (c) => {
    if (pdfSyncProgress.running) return c.json(pdfSyncProgress, 409);
    if (!cfg.toi.baseUrl || !cfg.toi.cookie || !cfg.toi.xsrf) {
      return c.json({ error: "TOI not configured. Set toi.baseUrl, toi.cookie, toi.xsrf in settings.json." }, 400);
    }
    const all = repo.listAll();
    const missing = all.filter((p) => !hasPdf(options.problemsDir, p.slug));
    pdfSyncProgress = {
      running: true,
      total: missing.length,
      done: 0,
      synced: 0,
      skipped: all.length - missing.length,
      failed: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    void (async () => {
      try {
        for (let i = 0; i < missing.length; i += 8) {
          const batch = missing.slice(i, i + 8);
          await Promise.all(batch.map(async (problem) => {
            const result = await fetchPdf({
              baseUrl: cfg.toi.baseUrl,
              cookie: cfg.toi.cookie,
              xsrf: cfg.toi.xsrf,
              extraHeaders: cfg.toi.extraHeaders,
              slug: problem.slug,
            });
            if (!result.ok) {
              pdfSyncProgress.failed.push({ slug: problem.slug, error: result.error });
            } else {
              writePdfAtomic(options.problemsDir, problem.slug, result.bytes);
              pdfSyncProgress.synced += 1;
            }
            pdfSyncProgress.done += 1;
          }));
        }
      } finally {
        pdfSyncProgress.running = false;
        pdfSyncProgress.finishedAt = new Date().toISOString();
      }
    })();

    return c.json(pdfSyncProgress, 202);
  });

  r.get("/sync-pdfs-progress", (c) => c.json(pdfSyncProgress));

  return r;
}

interface PdfSyncProgress {
  running: boolean;
  total: number;
  done: number;
  synced: number;
  skipped: number;
  failed: { slug: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
}

// Module-level singleton — same pattern as syncProgress in api/toi.ts. One
// bulk job at a time, survives across requests, resets on server restart.
let pdfSyncProgress: PdfSyncProgress = {
  running: false,
  total: 0,
  done: 0,
  synced: 0,
  skipped: 0,
  failed: [],
  startedAt: null,
  finishedAt: null,
};
