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
 * Two layouts seen in the wild:
 *
 * A) Current 00-pre-toi layout (verified live 2026-05-29) — slug lives in
 *    `<th>SLUG</th>`, there is NO นับ/ไม่นับ column at all. Treat every
 *    matched row as counts=1 (the contest counts every task).
 *      <tr>
 *        <td class="public_score …">NN / 100</td>
 *        <th>A1-001</th>
 *        <td>title</td>
 *        <td>1.000 second</td>
 *        <td>8.00 MiB</td>
 *        <td>Batch</td>
 *        <td>A1-001[.cpp|.c|.py]</td>
 *      </tr>
 *
 * B) Older layout that some contests still serve — slug is inside a
 *    `<a href="/tasks/SLUG/…">Title</a>` in a `<td>`, and a separate cell
 *    contains the literal "นับ" or "ไม่นับ" marker.
 *
 * The parser handles both: slug is matched from either the <th> or a
 * /tasks/SLUG/ link; counts default to 1 when no marker cell is present and
 * become 0 only when "ไม่นับ" is explicitly seen in the row's <td>s.
 */
export function parseCounts(html: string): Map<string, 0 | 1> {
  const result = new Map<string, 0 | 1>();
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const row = rowMatch[1] ?? "";
    // Try <th>SLUG</th> first (current layout). Fall back to the /tasks/ link
    // form (older layout). The slug-shaped regex filters the header row.
    let slug: string | null = null;
    const thMatch = row.match(/<th\b[^>]*>\s*([A-Z]\d+-\d+)\s*<\/th>/);
    if (thMatch) slug = thMatch[1]!;
    if (!slug) {
      const linkMatch = row.match(/\/tasks\/([A-Za-z0-9_-]+)\//);
      if (linkMatch) slug = linkMatch[1]!;
    }
    if (!slug) continue;

    const tdTexts: string[] = [];
    for (const tdMatch of row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
      tdTexts.push((tdMatch[1] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim());
    }
    // ONLY emit rows that have an explicit นับ / ไม่นับ marker. Layouts
    // without a counts column (current 00-pre-toi) fall through and the
    // caller leaves `toi_counts` at whatever the user set manually. Implicit
    // "default to 1" here would silently overwrite user toggles every sync.
    if (tdTexts.includes("ไม่นับ")) result.set(slug, 0);
    else if (tdTexts.includes("นับ")) result.set(slug, 1);
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
    if (counts.size === 0) return { ok: false, error: "no task rows found (page layout may have changed)" };
    return { ok: true, counts };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}
