export interface ToiSubmitInput {
  baseUrl: string;        // e.g. "https://toi-coding.informatics.buu.ac.th/00-pre-toi"
  cookie: string;         // login cookie value OR full Cookie header
  xsrf: string;           // _xsrf token (form field + matches cookie)
  extraHeaders: Record<string, string>;
  slug: string;           // TOI task slug, e.g. "A1-001"
  language: "c" | "cpp" | "py";
  code: string;
}

/**
 * Build the Cookie header from the configured cookie + xsrf.
 * Accepts either:
 *  - a raw login cookie value (no "=" present) -> synthesizes "_xsrf=X; 00-pre-toi_login=Y"
 *  - a full Cookie header (contains "=") -> passed through verbatim, with _xsrf ensured
 */
export function buildCookieHeader(cookie: string, xsrf: string): string {
  if (cookie.includes("=")) {
    // Already a Cookie header. Ensure _xsrf is present.
    if (!/\b_xsrf=/.test(cookie)) {
      return `_xsrf=${xsrf}; ${cookie}`;
    }
    return cookie;
  }
  // Treat as raw 00-pre-toi_login value.
  return `_xsrf=${xsrf}; 00-pre-toi_login=${cookie}`;
}

export interface ToiSubmitResult {
  status: number | null;
  body: unknown;
  error: string | null;
  contentType?: string;
  finalUrl?: string;
  redirected?: boolean;
  submitted?: boolean;
}

export interface ToiSubmitResponseMeta {
  ok: boolean;
  status: number;
  contentType: string;
  finalUrl: string;
  redirected: boolean;
  text: string;
}

export function classifyToiSubmitResponse(meta: ToiSubmitResponseMeta): string | null {
  const contentType = meta.contentType.toLowerCase();
  const finalUrl = meta.finalUrl.toLowerCase();
  const text = meta.text.slice(0, 4000);
  const lower = text.toLowerCase();

  if (lower.includes("csrf") || lower.includes("_xsrf") || lower.includes("xsrf")) {
    return "TOI rejected the session token. Refresh cookie and XSRF in settings.json, then try again.";
  }

  if (finalUrl.includes("/login") || finalUrl.endsWith("/login/")) {
    return "TOI redirected to login. Your cookie is expired or not for this TOI base URL.";
  }

  if (contentType.includes("text/html")) {
    if (
      lower.includes("login") ||
      lower.includes("sign in") ||
      lower.includes("password") ||
      lower.includes("logout")
    ) {
      return "TOI returned a login/session page instead of a submission result. Refresh cookie and XSRF in settings.json.";
    }
    return "TOI returned HTML instead of a submission result. The submit likely did not reach the grader.";
  }

  if (!meta.ok) return `HTTP ${meta.status}`;
  return null;
}

const LANGUAGE_MAP: Record<"c" | "cpp" | "py", string> = {
  cpp: "C++17 / g++",
  c:   "C11 / gcc",
  py:  "Python 3",
};

const FILE_EXT: Record<"c" | "cpp" | "py", string> = {
  cpp: "cpp",
  c:   "c",
  py:  "py",
};

export async function submitToToi(input: ToiSubmitInput): Promise<ToiSubmitResult> {
  const url = `${input.baseUrl.replace(/\/$/, "")}/tasks/${encodeURIComponent(input.slug)}/submit`;

  const form = new FormData();
  form.append("_xsrf", input.xsrf);
  form.append("language", LANGUAGE_MAP[input.language]);
  const filename = `solution.${FILE_EXT[input.language]}`;
  form.append("source_code", new Blob([input.code], { type: "text/plain" }), filename);

  const headers: Record<string, string> = {
    Cookie: buildCookieHeader(input.cookie, input.xsrf),
    Referer: input.baseUrl,
    "X-Xsrftoken": input.xsrf,
    ...input.extraHeaders,
  };
  // Do NOT set Content-Type — fetch sets multipart boundary automatically.

  try {
    const res = await fetch(url, { method: "POST", headers, body: form, redirect: "follow" });
    const text = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    const error = classifyToiSubmitResponse({
      ok: res.ok,
      status: res.status,
      contentType,
      finalUrl: res.url,
      redirected: res.redirected,
      text,
    });
    let parsed: unknown = text.slice(0, 4000);
    try { parsed = JSON.parse(text); } catch { /* keep as text */ }
    return {
      status: res.status,
      body: parsed,
      error,
      contentType,
      finalUrl: res.url,
      redirected: res.redirected,
      submitted: error === null,
    };
  } catch (e: any) {
    return { status: null, body: null, error: e?.message ?? String(e), submitted: false };
  }
}
