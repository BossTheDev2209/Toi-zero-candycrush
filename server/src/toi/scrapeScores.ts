import { buildCookieHeader } from "./submit";

export interface FetchBestScoreInput {
  baseUrl: string;
  cookie: string;
  xsrf: string;
  extraHeaders: Record<string, string>;
  slug: string;
}

export type FetchBestScoreResult =
  | { ok: true; score: number }
  | { ok: false; error: string };

export function isLoginHtml(html: string): boolean {
  const lower = html.slice(0, 2000).toLowerCase();
  return lower.includes("please log in") || lower.includes("action='/login") || lower.includes('action="/login') || lower.includes(">login<");
}

export function parseBestScore(html: string): number {
  let best = 0;
  const rowPattern = /<tr\b[^>]*data-submission=["'][^"']+["'][^>]*>([\s\S]*?)<\/tr>/gi;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const row = rowMatch[1] ?? "";
    for (const scoreMatch of row.matchAll(/\b(\d{1,3})\s*\/\s*100\b/g)) {
      best = Math.max(best, Number(scoreMatch[1]));
    }
  }
  return Math.max(0, Math.min(100, best));
}

export async function fetchBestScore(input: FetchBestScoreInput): Promise<FetchBestScoreResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const url = `${base}/tasks/${encodeURIComponent(input.slug)}/submissions`;
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: buildCookieHeader(input.cookie, input.xsrf),
        Referer: base,
        "X-Xsrftoken": input.xsrf,
        ...input.extraHeaders,
      },
      redirect: "follow",
    });
    const html = await res.text();
    if (isLoginHtml(html)) return { ok: false, error: "cookie expired, re-paste in settings.json" };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, score: parseBestScore(html) };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}
