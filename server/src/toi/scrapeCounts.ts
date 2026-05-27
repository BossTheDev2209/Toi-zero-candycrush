import { buildCookieHeader } from "./submit";
import { isLoginHtml } from "./scrapeScores";

export interface FetchCountsInput {
  baseUrl: string;
  cookie: string;
  xsrf: string;
  extraHeaders: Record<string, string>;
}

export type FetchCountsResult =
  | { ok: true; counts: Map<string, 0 | 1> }
  | { ok: false; error: string };

/**
 * Parse the TOI overview page HTML and produce a map of {slug -> counts (0 | 1)}.
 *
 * The overview table has rows with this td layout (verified live):
 *   0: score "X / 100"
 *   1: task name link (href contains /tasks/{slug}/...)
 *   2: time limit
 *   3: memory limit
 *   4: type ("Batch")
 *   5: allowed files ("slug[.cpp|.c|.py]")
 *   6: "นับ" or "ไม่นับ"
 *   7: PDF download button
 *   8: submit code button
 */
export function parseCounts(html: string): Map<string, 0 | 1> {
  const result = new Map<string, 0 | 1>();
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const row = rowMatch[1] ?? "";
    const slugMatch = row.match(/\/tasks\/([A-Za-z0-9_-]+)\//);
    if (!slugMatch) continue;
    const slug = slugMatch[1]!;
    const tdTexts: string[] = [];
    for (const tdMatch of row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
      const text = (tdMatch[1] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      tdTexts.push(text);
    }
    if (tdTexts.length < 7) continue;
    const countsCell = tdTexts[6]!;
    if (countsCell === "นับ") result.set(slug, 1);
    else if (countsCell === "ไม่นับ") result.set(slug, 0);
  }
  return result;
}

export async function fetchCounts(input: FetchCountsInput): Promise<FetchCountsResult> {
  const url = input.baseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: buildCookieHeader(input.cookie, input.xsrf),
        Referer: url,
        "X-Xsrftoken": input.xsrf,
        ...input.extraHeaders,
      },
      redirect: "follow",
    });
    const html = await res.text();
    if (isLoginHtml(html)) return { ok: false, error: "cookie expired, re-paste in settings.json" };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const counts = parseCounts(html);
    if (counts.size === 0) return { ok: false, error: "no นับ/ไม่นับ rows found (page layout may have changed)" };
    return { ok: true, counts };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}
