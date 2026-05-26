import { buildCookieHeader } from "./submit";

export interface FetchPdfInput {
  baseUrl: string;
  cookie: string;
  xsrf: string;
  extraHeaders: Record<string, string>;
  slug: string;
}

export type FetchPdfResult =
  | { ok: true; bytes: Uint8Array; sizeKb: number }
  | { ok: false; error: string };

export function isExpiredLoginHtml(contentType: string | null, headText: string): boolean {
  const type = (contentType ?? "").toLowerCase();
  const head = headText.toLowerCase();
  return type.startsWith("text/html") || head.includes("please log in") || head.includes("login");
}

export async function fetchPdf(input: FetchPdfInput): Promise<FetchPdfResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const url = `${base}/tasks/${encodeURIComponent(input.slug)}/statements/TH`;
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
    const contentType = res.headers.get("content-type");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const headText = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 200));

    if (isExpiredLoginHtml(contentType, headText)) {
      return { ok: false, error: "cookie expired, re-paste in settings.json" };
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    if (!(contentType ?? "").toLowerCase().startsWith("application/pdf")) {
      return { ok: false, error: `expected PDF, got ${contentType ?? "unknown content type"}` };
    }
    return { ok: true, bytes, sizeKb: Math.round(bytes.byteLength / 102.4) / 10 };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}
