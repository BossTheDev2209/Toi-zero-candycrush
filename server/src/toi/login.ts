/**
 * Logs in to TOI's Tornado-based CMS using stored username + password.
 *
 * Flow:
 *  1. GET {baseUrl}/  -> grabs the fresh _xsrf cookie + matching form-field value from the
 *     login page (we accept either; the cookie itself is what Tornado validates).
 *  2. POST {baseUrl}/login  with _xsrf + username + password (urlencoded).
 *  3. Parse Set-Cookie headers from the response to extract a fresh `00-pre-toi_login`
 *     value. Return both that and the _xsrf we used.
 *
 * IMPORTANT: this module never logs the password. Errors are reported as short strings
 * without echoing credentials.
 */

export interface LoginInput {
  baseUrl: string;       // e.g. "https://toi-coding.informatics.buu.ac.th/00-pre-toi"
  username: string;
  password: string;
}

export type LoginResult =
  | { ok: true; cookie: string; xsrf: string }
  | { ok: false; error: string };

/** Parse one or more Set-Cookie response headers into a name -> value map. */
function parseSetCookies(res: Response): Map<string, string> {
  const out = new Map<string, string>();
  // Bun's Response.headers.getSetCookie() returns an array in 1.3+.
  const raw =
    typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get("set-cookie")?.split(/,(?=\s*[A-Za-z0-9_-]+=)/g) ?? [];
  for (const line of raw) {
    const first = line.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (name) out.set(name, value);
  }
  return out;
}

/** Extract the _xsrf form field value from a login page's HTML. */
export function extractXsrfField(html: string): string | null {
  const m = html.match(/name=["']_xsrf["']\s+value=["']([^"']+)["']/);
  return m?.[1] ?? null;
}

export async function loginToToi(input: LoginInput): Promise<LoginResult> {
  const base = input.baseUrl.replace(/\/$/, "");

  // Step 1: fetch the login page so we get a Set-Cookie for _xsrf AND can extract the form-field _xsrf.
  let cookieXsrf: string | null = null;
  let formXsrf: string | null = null;
  try {
    const res = await fetch(base, { redirect: "follow" });
    const html = await res.text();
    formXsrf = extractXsrfField(html);
    const setCookies = parseSetCookies(res);
    cookieXsrf = setCookies.get("_xsrf") ?? null;
  } catch (e: any) {
    return { ok: false, error: `failed to load login page: ${e?.message ?? String(e)}` };
  }

  // Tornado validates that the form _xsrf equals the cookie _xsrf. Use whichever pair we have.
  const xsrf = cookieXsrf ?? formXsrf;
  if (!xsrf) return { ok: false, error: "could not find _xsrf on login page" };

  // Step 2: POST credentials.
  const body = new URLSearchParams();
  body.set("_xsrf", formXsrf ?? xsrf);
  body.set("username", input.username);
  body.set("password", input.password);

  let loginRes: Response;
  try {
    loginRes = await fetch(`${base}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: `_xsrf=${xsrf}`,
        Referer: base,
      },
      body: body.toString(),
      redirect: "manual",  // need to read Set-Cookie BEFORE following the redirect
    });
  } catch (e: any) {
    return { ok: false, error: `login POST failed: ${e?.message ?? String(e)}` };
  }

  const setCookies = parseSetCookies(loginRes);
  const loginCookie = setCookies.get("00-pre-toi_login");
  const refreshedXsrf = setCookies.get("_xsrf") ?? xsrf;

  if (!loginCookie) {
    // No login cookie usually means wrong credentials — TOI re-renders the login page.
    // Distinguish "bad creds" from "server error" but never echo the password.
    if (loginRes.status >= 200 && loginRes.status < 400) {
      return { ok: false, error: "login rejected (check username/password)" };
    }
    return { ok: false, error: `login HTTP ${loginRes.status}` };
  }

  return { ok: true, cookie: loginCookie, xsrf: refreshedXsrf };
}
