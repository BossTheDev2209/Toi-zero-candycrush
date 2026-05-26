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

  r.post("/sync-pdfs", async (c) => {
    if (!cfg.toi.baseUrl || !cfg.toi.cookie || !cfg.toi.xsrf) {
      return c.json({ error: "TOI not configured. Set toi.baseUrl, toi.cookie, toi.xsrf in settings.json." }, 400);
    }
    const missing = repo.listAll().filter((p) => !hasPdf(options.problemsDir, p.slug));
    let synced = 0;
    let skipped = repo.listAll().length - missing.length;
    const failed: { slug: string; error: string }[] = [];

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
          failed.push({ slug: problem.slug, error: result.error });
          return;
        }
        writePdfAtomic(options.problemsDir, problem.slug, result.bytes);
        synced += 1;
      }));
    }
    return c.json({ synced, skipped, failed });
  });

  return r;
}
