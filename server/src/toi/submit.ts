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

  // CMS's generic Error 403 page (literally `<title>Error 403</title>` + `<h1>Error 403</h1>`
  // + "tamper with Contest Management System" boilerplate). Submits hit this when the
  // `_xsrf` cookie has rotated server-side but settings.json still holds the old token —
  // the login cookie itself stays valid much longer, so a 403 here is almost always
  // stale-XSRF, not a real auth failure. Surface a message containing "xsrf" so the
  // caller's auto-recovery path (xsrf refresh → retry → full re-login) kicks in.
  if (meta.status === 403 && /Error\s*403/i.test(text)) {
    return "TOI rejected the submit (HTTP 403) — likely stale _xsrf. Refreshing token and retrying.";
  }

  // CMS (the open-source contest manager TOI runs on) does not return JSON for
  // the submit endpoint. On success it 303-redirects to /tasks/<slug>/submissions
  // and re-renders the contestant's submissions list — that page is the success
  // signal. Recognise it here so a real submit is not flagged as a failure. The
  // user confirms the verdict via the "Open TOI submissions" link in the UI.
  if (
    meta.ok &&
    /\/tasks\/[^/]+\/submissions(\/|$|\?)/.test(finalUrl) &&
    (lower.includes("cws_utils") || lower.includes("cwsutils"))
  ) {
    return null;
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

/**
 * CMS's per-language string for the `language` form field. Must match the
 * <option value="..."> values on the task page exactly — CMS does a literal
 * string lookup against its configured language list. Confirmed against the
 * actual TOI A1 submit form on 2026-05-28.
 */
const LANGUAGE_MAP: Record<"c" | "cpp" | "py", string> = {
  cpp: "C++17 / g++",
  c:   "C11 / gcc",
  py:  "Python 3 / CPython",
};

const FILE_EXT: Record<"c" | "cpp" | "py", string> = {
  cpp: "cpp",
  c:   "c",
  py:  "py",
};

/**
 * Construct the multipart file-field name CMS expects for this task's
 * submission. TOI's tasks use the CMS submission_format convention where the
 * field name is `<task-slug>.%l` — the `%l` is a literal placeholder that CMS
 * substitutes server-side based on the `language` field. Using the wrong name
 * (e.g. `source_code`) makes CMS return "Invalid submission format!" via a
 * flash notification while still redirecting to the submissions page, which
 * looks like success in the redirect target HTML.
 */
export function submitFieldName(slug: string): string {
  return `${slug}.%l`;
}

/**
 * CMS surfaces submit rejections as flash notifications fetched by the browser
 * via XHR to /notifications — they are NOT in the redirect-target HTML the
 * submit POST returns. After a submit that looks successful at the HTTP layer
 * (200 + redirect to /submissions), we GET /notifications to confirm there's
 * no rejection flash. Returns the rejection text if one exists, else null.
 */
export async function fetchSubmitErrorFromNotifications(
  baseUrl: string,
  cookie: string,
  xsrf: string,
  extraHeaders: Record<string, string>,
  sinceSeconds: number,
): Promise<string | null> {
  const url = `${baseUrl.replace(/\/$/, "")}/notifications?last_notification=${encodeURIComponent(String(sinceSeconds))}`;
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: buildCookieHeader(cookie, xsrf),
        ...extraHeaders,
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    let data: unknown;
    try { data = JSON.parse(text); } catch { return null; }
    if (!Array.isArray(data) || data.length === 0) return null;
    type Notif = { type?: string; subject?: string; text?: string };
    const arr = data as Notif[];
    // Only `error` notifications mean a real rejection. CMS also emits success-style
    // notifications like "Submission received — Your submission has been received and
    // is currently being evaluated" — those are confirmations, NOT failures, and we
    // must not surface them as errors. (This was a regression: an earlier version
    // fell back to arr[0], which flipped successful submits into "TOI rejected".)
    const err = arr.find((n) => n?.type === "error");
    if (!err) return null;
    const parts = [err.subject?.trim(), err.text?.trim()].filter(Boolean) as string[];
    if (parts.length === 0) return null;
    return parts.join(" — ");
  } catch {
    return null;
  }
}

export async function submitToToi(input: ToiSubmitInput): Promise<ToiSubmitResult> {
  const url = `${input.baseUrl.replace(/\/$/, "")}/tasks/${encodeURIComponent(input.slug)}/submit`;

  const fieldName = submitFieldName(input.slug);
  const form = new FormData();
  form.append("_xsrf", input.xsrf);
  form.append("language", LANGUAGE_MAP[input.language]);
  const filename = `${input.slug}.${FILE_EXT[input.language]}`;
  form.append(fieldName, new Blob([input.code], { type: "text/plain" }), filename);

  const headers: Record<string, string> = {
    Cookie: buildCookieHeader(input.cookie, input.xsrf),
    Referer: input.baseUrl,
    "X-Xsrftoken": input.xsrf,
    ...input.extraHeaders,
  };
  // Do NOT set Content-Type — fetch sets multipart boundary automatically.

  // Capture submit start time so we can ask CMS for any rejection notifications
  // that landed in this submit's window. 5-second backstop so we still catch the
  // flash if CMS's clock is slightly ahead of ours.
  const submittedAtSec = Math.floor(Date.now() / 1000) - 5;

  try {
    const res = await fetch(url, { method: "POST", headers, body: form, redirect: "follow" });
    const text = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    let error = classifyToiSubmitResponse({
      ok: res.ok,
      status: res.status,
      contentType,
      finalUrl: res.url,
      redirected: res.redirected,
      text,
    });
    let parsed: unknown = text.slice(0, 4000);
    try { parsed = JSON.parse(text); } catch { /* keep as text */ }

    // Even when the redirect-target HTML looks like a success (submissions list
    // page, no auth keywords), CMS may have flashed a rejection notification.
    // Verify by polling the notifications endpoint — if there's an error there,
    // surface it instead of falsely declaring success.
    if (error === null) {
      const notifErr = await fetchSubmitErrorFromNotifications(
        input.baseUrl,
        input.cookie,
        input.xsrf,
        input.extraHeaders,
        submittedAtSec,
      );
      if (notifErr) {
        error = `TOI rejected the submit: ${notifErr}`;
      }
    }

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
