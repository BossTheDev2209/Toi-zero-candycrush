import { buildCookieHeader } from "./submit";
import { isLoginHtml } from "./scrapeScores";

export interface FetchSubmissionInput {
  baseUrl: string;
  cookie: string;
  xsrf: string;
  extraHeaders: Record<string, string>;
  slug: string;
}

export type Language = "c" | "cpp" | "py";

export interface SubmissionMeta {
  id: number;
  score: number;
  /** Filename from the download link, e.g. "A1-001.cpp". */
  filename: string;
  language: Language;
}

export type FetchSubmissionResult =
  | { ok: true; language: Language; code: string; score: number; submissionId: number }
  | { ok: false; error: string };

/** Map a source-file extension to our 3-language enum. CMS serves .cpp/.c/.py for TOI. */
function extToLanguage(ext: string): Language | null {
  const e = ext.toLowerCase();
  if (e === "c") return "c";
  if (e === "py") return "py";
  if (e === "cpp" || e === "cc" || e === "cxx" || e === "c++") return "cpp";
  return null;
}

/**
 * Parse a CMS submissions-list page and return the BEST submission's metadata,
 * or null if there are no downloadable submissions.
 *
 * Row shape (verified live 2026-05-29):
 *   <tr data-submission="7" data-status="5">
 *     <td class="datetime">…</td>
 *     <td class="status">Evaluated <a class="details">details</a></td>
 *     <td class="public_score score_100">100 / 100</td>
 *     <td class="files">
 *       <a class="btn" href="../../../00-pre-toi/tasks/A1-001/submissions/7/files/A1-001.cpp">Download</a>
 *     </td>
 *   </tr>
 *
 * "Best" = highest score; ties broken by highest submission id (the most
 * recent attempt at that score). Rows without a recognizable source file
 * (.cpp/.c/.py) are skipped — we can only load languages the editor supports.
 */
export function parseBestSubmission(html: string): SubmissionMeta | null {
  const rowPattern = /<tr\b[^>]*data-submission=["'](\d+)["'][^>]*>([\s\S]*?)<\/tr>/gi;
  let best: SubmissionMeta | null = null;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const id = Number(rowMatch[1]);
    const row = rowMatch[2] ?? "";

    // Highest "N / 100" in the row is the score.
    let score = 0;
    for (const m of row.matchAll(/\b(\d{1,3})\s*\/\s*100\b/g)) {
      score = Math.max(score, Number(m[1]));
    }

    // Download link → filename + extension. Anchor to /submissions/<id>/files/
    // so we don't accidentally match an unrelated href.
    const fileMatch = row.match(/\/submissions\/\d+\/files\/([^"'?]+\.([A-Za-z0-9+]+))/);
    if (!fileMatch) continue;
    const filename = decodeURIComponent(fileMatch[1]!);
    const language = extToLanguage(fileMatch[2]!);
    if (!language) continue;

    const candidate: SubmissionMeta = { id, score, filename, language };
    if (
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.id > best.id)
    ) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Fetch the contestant's best submission source for a task. GETs the
 * submissions list, picks the best row, then downloads that submission's
 * source file. Auth uses the same cookie/xsrf headers as the score scraper.
 */
export async function fetchBestSubmissionSource(input: FetchSubmissionInput): Promise<FetchSubmissionResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const headers = {
    Cookie: buildCookieHeader(input.cookie, input.xsrf),
    Referer: base,
    "X-Xsrftoken": input.xsrf,
    ...input.extraHeaders,
  };

  try {
    const listUrl = `${base}/tasks/${encodeURIComponent(input.slug)}/submissions`;
    const listRes = await fetch(listUrl, { headers, redirect: "follow" });
    const listHtml = await listRes.text();
    if (isLoginHtml(listHtml)) return { ok: false, error: "cookie expired, re-paste in settings.json" };
    if (!listRes.ok) return { ok: false, error: `HTTP ${listRes.status}` };

    const best = parseBestSubmission(listHtml);
    if (!best) return { ok: false, error: "no downloadable submission found for this task" };

    // Build the file URL directly from known parts rather than resolving the
    // relative href — avoids fragile ../../.. resolution.
    const fileUrl = `${base}/tasks/${encodeURIComponent(input.slug)}/submissions/${best.id}/files/${encodeURIComponent(best.filename)}`;
    const fileRes = await fetch(fileUrl, { headers, redirect: "follow" });
    const code = await fileRes.text();
    // A login redirect here comes back as HTML, not source.
    if (isLoginHtml(code)) return { ok: false, error: "cookie expired, re-paste in settings.json" };
    if (!fileRes.ok) return { ok: false, error: `HTTP ${fileRes.status} downloading source` };
    if (!code.trim()) return { ok: false, error: "downloaded source was empty" };

    return { ok: true, language: best.language, code, score: best.score, submissionId: best.id };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}
