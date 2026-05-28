/**
 * Refresh the `_xsrf` token by GET-ing the contest landing page with the current
 * login cookie. Cheaper than a full re-login: doesn't touch the password, doesn't
 * roll the session cookie, just picks up whatever fresh `_xsrf` CMS hands out.
 *
 * Why this exists: CMS (the open-source Contest Management System TOI runs on)
 * uses a double-submit XSRF token — the `_xsrf` cookie and the `_xsrf` form field
 * must match. CMS rotates the `_xsrf` cookie over time (typically daily). The
 * login cookie (`00-pre-toi_login`) usually outlives `_xsrf`, so submits start
 * returning HTTP 403 with the generic "Error 403" page while every other read
 * still works. This refresher is the targeted fix for that case.
 */

import { parseSetCookies, extractXsrfField } from "./login";
import { buildCookieHeader } from "./submit";

export interface RefreshXsrfInput {
  baseUrl: string;
  cookie: string;
  oldXsrf: string;
  extraHeaders?: Record<string, string>;
}

export type RefreshXsrfResult =
  | { ok: true; xsrf: string; changed: boolean }
  | { ok: false; error: string };

/**
 * CMS quirk: when the login cookie is stale, a GET to the contest landing returns
 * HTTP 200 (NOT a /login redirect — that's only for unauthenticated browsers).
 * Instead CMS silently logs the session out by sending Set-Cookie with an empty
 * value for `00-pre-toi_login`, and serves the anonymous public landing page.
 *
 * If we don't detect this, we'd extract the anonymous `_xsrf` from that page,
 * declare the refresh successful, and the retry would submit with (stale login
 * cookie + valid-but-anonymous xsrf) → another 403. The cookie-clearing Set-Cookie
 * is the reliable signal that we need a FULL re-login, not just an xsrf bump.
 */
function loginCookieWasCleared(res: Response): boolean {
  const setCookies = parseSetCookies(res);
  if (!setCookies.has("00-pre-toi_login")) return false;
  const v = setCookies.get("00-pre-toi_login") ?? "";
  return v.trim() === "";
}

/**
 * Defence-in-depth signal: even if CMS didn't send a cookie-clearing Set-Cookie,
 * an anonymous landing page will contain a login form. Detecting either an input
 * named "password" or the inline call `cmsutil_login(` (CMS's login-form helper)
 * means we're looking at the logged-out view.
 */
function looksLikeAnonymousLanding(html: string): boolean {
  const lower = html.toLowerCase();
  return /name=["']password["']/.test(lower) || lower.includes("cmsutil_login(");
}

export async function refreshXsrfFromContest(input: RefreshXsrfInput): Promise<RefreshXsrfResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(base, {
      headers: {
        Cookie: buildCookieHeader(input.cookie, input.oldXsrf),
        ...input.extraHeaders,
      },
      redirect: "follow",
    });

    // Hard fail: CMS told us our login is dead. Caller falls back to re-login.
    if (loginCookieWasCleared(res)) {
      return { ok: false, error: "session expired — CMS cleared 00-pre-toi_login, need full re-login" };
    }

    // Prefer the cookie value (that's what CMS validates the form field against).
    // Fall back to a hidden form field on the page if no Set-Cookie was returned (CMS
    // sometimes omits the Set-Cookie when the existing _xsrf is still considered fresh).
    const setCookies = parseSetCookies(res);
    let xsrf = setCookies.get("_xsrf") ?? null;
    let html: string | null = null;
    if (!xsrf) {
      html = await res.text();
      xsrf = extractXsrfField(html);
    }

    // Even if we got an xsrf, verify we're not actually looking at the anonymous
    // landing. That xsrf would be valid in isolation but useless against an
    // authenticated submit — we'd just hit 403 again on retry.
    if (html === null) html = await res.text().catch(() => "");
    if (looksLikeAnonymousLanding(html)) {
      return { ok: false, error: "session expired — contest landing is the anonymous view, need full re-login" };
    }

    if (!xsrf) return { ok: false, error: "could not find _xsrf after contest GET" };

    return { ok: true, xsrf, changed: xsrf !== input.oldXsrf };
  } catch (e: any) {
    return { ok: false, error: `xsrf refresh failed: ${e?.message ?? String(e)}` };
  }
}
