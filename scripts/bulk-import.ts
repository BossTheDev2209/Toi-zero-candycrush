/**
 * Scrape the TOI contest overview page using the cookie/xsrf saved in
 * settings.json, then POST the discovered tasks (slug + title + category +
 * time/memory limits) to the local API's /api/problems/bulk endpoint.
 *
 *   bun run scripts/bulk-import.ts
 *
 * Requires the dev server to be running (so we can call /api/problems/bulk)
 * and a valid TOI session in settings.json — Settings → Save credentials in
 * the web UI is the easiest way to get one.
 *
 * Row layout on the real TOI overview page (verified 2026-05-29):
 *   <tr>
 *     <td class="public_score score_NN">NN / 100</td>  ← score
 *     <th>A1-001</th>                                   ← slug (in <th>, NOT <td>)
 *     <td>สวัสดี: ชื่อ</td>                              ← title
 *     <td>1.000 second</td>                             ← time limit
 *     <td>8.00 MiB</td>                                 ← memory limit
 *     <td>Batch</td>                                    ← type
 *     <td>A1-001[.cpp|.c|.py]</td>                      ← submission files
 *   </tr>
 * (There is NO นับ/ไม่นับ column on this contest — `parseCounts` won't work
 * here and counts will fall back to the default 1.)
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
function findRoot(start: string): string {
  let cur = resolve(start);
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(cur, "settings.json"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error("settings.json not found walking up from " + start);
}
const root = findRoot(here);
const cfg = JSON.parse(readFileSync(join(root, "settings.json"), "utf8")) as {
  apiPort: number;
  toi: {
    baseUrl: string;
    cookie: string;
    xsrf: string;
    extraHeaders?: Record<string, string>;
  };
};

if (!cfg.toi?.baseUrl || !cfg.toi?.cookie || !cfg.toi?.xsrf) {
  console.error("TOI not configured. Open Settings in the web UI, save your TOI username + password, then re-run.");
  process.exit(1);
}

const base = cfg.toi.baseUrl.replace(/\/$/, "");
const cookieHeader = cfg.toi.cookie.includes("=")
  ? (/\b_xsrf=/.test(cfg.toi.cookie) ? cfg.toi.cookie : `_xsrf=${cfg.toi.xsrf}; ${cfg.toi.cookie}`)
  : `_xsrf=${cfg.toi.xsrf}; 00-pre-toi_login=${cfg.toi.cookie}`;

const res = await fetch(base, {
  headers: {
    Cookie: cookieHeader,
    Referer: base,
    "X-Xsrftoken": cfg.toi.xsrf,
    ...(cfg.toi.extraHeaders ?? {}),
  },
  redirect: "follow",
});
const html = await res.text();
if (!res.ok) {
  console.error(`Failed to fetch TOI overview: HTTP ${res.status}`);
  process.exit(1);
}
if (/please log in|action=['"][^'"]*\/login/i.test(html)) {
  console.error("TOI session expired. Open Settings in the web UI and click Re-login, then re-run.");
  process.exit(1);
}

interface ImportItem {
  slug: string;
  title: string;
  category: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  sourceUrl: string;
  statementMd: string;
}

function cellText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const items: ImportItem[] = [];
const seen = new Set<string>();
for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const row = rowMatch[1] ?? "";
  // Slug lives in a <th>SLUG</th> inside the data row. The header row's <th>
  // values are "Score", "Task", "Name"… so the slug-shaped check filters those
  // out without needing a separate header-skip pass.
  const slugMatch = row.match(/<th\b[^>]*>\s*([A-Z]\d+-\d+)\s*<\/th>/);
  if (!slugMatch) continue;
  const slug = slugMatch[1]!;
  if (seen.has(slug)) continue;

  const tds: string[] = [];
  for (const td of row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
    tds.push(cellText(td[1] ?? ""));
  }
  // tds = [score, title, time, memory, type, files]
  const title = tds[1] || slug;
  const timeMs = (() => {
    const m = (tds[2] ?? "").match(/([\d.]+)/);
    return m ? Math.max(1, Math.round(parseFloat(m[1]!) * 1000)) : 1000;
  })();
  const memMb = (() => {
    const m = (tds[3] ?? "").match(/(\d+)/);
    return m ? Math.max(1, Number(m[1])) : 256;
  })();

  seen.add(slug);
  items.push({
    slug,
    title,
    category: slug.split("-")[0] || "general",
    timeLimitMs: timeMs,
    memoryLimitMb: memMb,
    sourceUrl: `${base}/tasks/${slug}/description`,
    statementMd: `See TOI: ${base}/tasks/${slug}/statements/TH`,
  });
}

if (items.length === 0) {
  console.error("No tasks parsed from the overview page. Either the page layout changed, or your account has no contest assigned.");
  process.exit(1);
}

console.log(`Parsed ${items.length} tasks from TOI. Posting to /api/problems/bulk...`);
const post = await fetch(`http://localhost:${cfg.apiPort ?? 8787}/api/problems/bulk`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(items),
});
const body = await post.text();
if (!post.ok) {
  console.error(`Bulk import failed: HTTP ${post.status}`);
  console.error(body);
  process.exit(1);
}
console.log(post.status, body);
