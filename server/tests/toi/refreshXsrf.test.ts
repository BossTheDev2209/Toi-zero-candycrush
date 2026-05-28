import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { refreshXsrfFromContest } from "../../src/toi/refreshXsrf";

const realFetch = globalThis.fetch;
let lastInit: RequestInit | undefined;

afterEach(() => { globalThis.fetch = realFetch; });
beforeEach(() => { lastInit = undefined; });

describe("refreshXsrfFromContest", () => {
  test("picks up a rotated _xsrf from Set-Cookie and flags it as changed", async () => {
    globalThis.fetch = (async (_url: string, init: RequestInit = {}) => {
      lastInit = init;
      return new Response("<html></html>", {
        status: 200,
        headers: {
          // Bun's getSetCookie() parses this correctly when accessed via the header API.
          "set-cookie": "_xsrf=NEW_TOKEN; Path=/",
        },
      });
    }) as typeof fetch;

    const result = await refreshXsrfFromContest({
      baseUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      cookie: "00-pre-toi_login=loginvalue",
      oldXsrf: "OLD_TOKEN",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.xsrf).toBe("NEW_TOKEN");
      expect(result.changed).toBe(true);
    }
    // Verify the GET carried the existing cookie so CMS could authenticate the session.
    const cookieHeader = (lastInit?.headers as Record<string, string>)?.Cookie ?? "";
    expect(cookieHeader).toContain("00-pre-toi_login=loginvalue");
    expect(cookieHeader).toContain("_xsrf=OLD_TOKEN");
  });

  test("falls back to extracting _xsrf from the HTML body when no Set-Cookie is returned", async () => {
    globalThis.fetch = (async () =>
      new Response(
        `<html><body><form><input type="hidden" name="_xsrf" value="FORM_TOKEN"/></form></body></html>`,
        { status: 200 },
      )
    ) as typeof fetch;

    const result = await refreshXsrfFromContest({
      baseUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      cookie: "00-pre-toi_login=loginvalue",
      oldXsrf: "OLD",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.xsrf).toBe("FORM_TOKEN");
  });

  test("reports changed: false when the rotated token is identical to the old one", async () => {
    globalThis.fetch = (async () =>
      new Response("<html></html>", {
        status: 200,
        headers: { "set-cookie": "_xsrf=SAME; Path=/" },
      })
    ) as typeof fetch;

    const result = await refreshXsrfFromContest({
      baseUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      cookie: "00-pre-toi_login=loginvalue",
      oldXsrf: "SAME",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.changed).toBe(false);
  });

  test("treats a Set-Cookie that clears the login cookie as session-expired (fall back to re-login)", async () => {
    // Real CMS behavior when the login cookie is stale: HTTP 200 + Set-Cookie clears
    // 00-pre-toi_login + renders the anonymous landing. xsrf-only refresh CANNOT
    // recover from this; we must surface ok:false so the caller does a full re-login.
    globalThis.fetch = (async () =>
      new Response("<html></html>", {
        status: 200,
        headers: { "set-cookie": "00-pre-toi_login=; Path=/" },
      })
    ) as typeof fetch;

    const result = await refreshXsrfFromContest({
      baseUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      cookie: "stale-login",
      oldXsrf: "old",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("re-login");
  });

  test("treats the anonymous landing page (login form present) as session-expired even without a cookie-clear", async () => {
    globalThis.fetch = (async () =>
      new Response(
        `<html><body><form action="/00-pre-toi/login">
           <input type="hidden" name="_xsrf" value="ANON_TOKEN"/>
           <input type="text" name="username"/>
           <input type="password" name="password"/>
         </form></body></html>`,
        { status: 200 },
      )
    ) as typeof fetch;

    const result = await refreshXsrfFromContest({
      baseUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      cookie: "stale-login",
      oldXsrf: "old",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("re-login");
  });

  test("returns a fail result when the GET throws", async () => {
    globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
    const result = await refreshXsrfFromContest({
      baseUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      cookie: "x",
      oldXsrf: "y",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ECONNREFUSED");
  });
});
