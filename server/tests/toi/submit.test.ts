import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  buildCookieHeader,
  classifyToiSubmitResponse,
  submitFieldName,
  fetchSubmitErrorFromNotifications,
  submitToToi,
} from "../../src/toi/submit";

describe("buildCookieHeader", () => {
  test("wraps a raw login cookie with xsrf", () => {
    expect(buildCookieHeader("login-cookie", "token")).toBe("_xsrf=token; 00-pre-toi_login=login-cookie");
  });

  test("passes through a full cookie header that already has xsrf", () => {
    expect(buildCookieHeader("_xsrf=token; 00-pre-toi_login=login-cookie", "other")).toBe("_xsrf=token; 00-pre-toi_login=login-cookie");
  });

  test("adds xsrf to a full cookie header when missing", () => {
    expect(buildCookieHeader("00-pre-toi_login=login-cookie", "token")).toBe("_xsrf=token; 00-pre-toi_login=login-cookie");
  });
});

describe("classifyToiSubmitResponse", () => {
  test("flags a 200 login html response as a failed submission", () => {
    const error = classifyToiSubmitResponse({
      ok: true,
      status: 200,
      contentType: "text/html; charset=utf-8",
      finalUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi/login",
      redirected: true,
      text: "<html><form><input type=\"password\" name=\"password\" /></form>Login</html>",
    });

    expect(error).toContain("login");
  });

  test("flags csrf/xsrf rejection text even when status is ok", () => {
    const error = classifyToiSubmitResponse({
      ok: true,
      status: 200,
      contentType: "text/plain",
      finalUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/A1-001/submit",
      redirected: false,
      text: "invalid _xsrf token",
    });

    expect(error).toContain("session token");
  });

  test("classifies a CMS 403 page as stale-xsrf so the caller's auto-recovery retries", () => {
    const error = classifyToiSubmitResponse({
      ok: false,
      status: 403,
      contentType: "text/html; charset=utf-8",
      finalUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/A1-008/submit",
      redirected: false,
      text: `<!DOCTYPE html><html><head><title>Error 403</title></head><body>
<div class="span9"><div class="page-header"><h1>Error 403</h1></div>
<p>An error occured while the server was handling your request.</p>
<p>Note that attempts to tamper with Contest Management System ...</p></div></body></html>`,
    });
    expect(error).not.toBeNull();
    expect(error!.toLowerCase()).toContain("xsrf");
    expect(error).toContain("403");
  });

  test("accepts CMS submissions-page redirect as a successful submit", () => {
    const error = classifyToiSubmitResponse({
      ok: true,
      status: 200,
      contentType: "text/html; charset=utf-8",
      finalUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/A1-003/submissions",
      redirected: true,
      text: `<!DOCTYPE html><html><head><title>การสอบคัดเลือก</title>
<script src="../../../static/cws_utils.js"></script>
<script>var utils = new CMS.CWSUtils("../../..", "../../../00-pre-toi", "00-pre-toi", 0, 0, 0, 0, 0);</script>
</head><body></body></html>`,
    });

    expect(error).toBeNull();
  });

  test("accepts non-html ok responses", () => {
    const error = classifyToiSubmitResponse({
      ok: true,
      status: 200,
      contentType: "application/json",
      finalUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/A1-001/submit",
      redirected: false,
      text: "{\"ok\":true}",
    });

    expect(error).toBeNull();
  });
});

describe("submitFieldName", () => {
  test("uses the CMS `<slug>.%l` convention so CMS recognises the file", () => {
    // Confirmed against the real TOI A1-007 submit form: the file input has
    // name="A1-007.%l". %l is a literal CMS placeholder, not interpolated client-side.
    expect(submitFieldName("A1-007")).toBe("A1-007.%l");
    expect(submitFieldName("A2-001")).toBe("A2-001.%l");
  });
});

describe("fetchSubmitErrorFromNotifications", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  test("returns subject + text when CMS reports an error notification", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([{ type: "error", subject: "Invalid submission format!", text: "Please select the correct files." }]),
        { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } },
      )
    ) as typeof fetch;

    const err = await fetchSubmitErrorFromNotifications(
      "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      "loginvalue",
      "xsrfvalue",
      {},
      0,
    );
    expect(err).not.toBeNull();
    expect(err!).toContain("Invalid submission format");
    expect(err!).toContain("Please select the correct files");
  });

  test("returns null when the only notification is a non-error (success/info) message", async () => {
    // CMS sends a success notification after every accepted submit:
    // "Submission received — Your submission has been received and is currently being evaluated."
    // That MUST NOT be classified as a rejection — it's the opposite.
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([{
          type: "success",
          subject: "Submission received",
          text: "Your submission has been received and is currently being evaluated.",
        }]),
        { status: 200 },
      )
    ) as typeof fetch;

    const err = await fetchSubmitErrorFromNotifications(
      "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      "x", "y", {}, 0,
    );
    expect(err).toBeNull();
  });

  test("returns null when notifications are empty (the success path)", async () => {
    globalThis.fetch = (async () =>
      new Response("[]", { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } })
    ) as typeof fetch;

    const err = await fetchSubmitErrorFromNotifications(
      "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      "x", "y", {}, 0,
    );
    expect(err).toBeNull();
  });

  test("returns null silently when the endpoint errors or body is unparseable", async () => {
    globalThis.fetch = (async () =>
      new Response("not-json", { status: 200 })
    ) as typeof fetch;

    const err = await fetchSubmitErrorFromNotifications(
      "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      "x", "y", {}, 0,
    );
    expect(err).toBeNull();
  });
});

describe("submitToToi (integration of field name + notification check)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  test("flags 'Invalid submission format' even when the submit POST 200/redirects to /submissions", async () => {
    // Reproduce the user-facing bug: CMS rejects via flash, redirects to
    // submissions list, our classifier sees the success-looking HTML, and only
    // the notifications endpoint reveals the rejection.
    const submissionsPage = `<!DOCTYPE html><html><head><script src="cws_utils.js"></script>
      <script>var utils = new CMS.CWSUtils("..","..","00-pre-toi",0,0,0,0,0);</script></head></html>`;
    let callCount = 0;
    globalThis.fetch = (async (url: string) => {
      callCount += 1;
      if (callCount === 1) {
        // The submit POST: CMS redirected us to /submissions.
        return new Response(submissionsPage, {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        });
      }
      // The notifications check.
      expect(url).toContain("/notifications");
      return new Response(
        JSON.stringify([{ type: "error", subject: "Invalid submission format!", text: "Please select the correct files." }]),
        { status: 200 },
      );
    }) as typeof fetch;
    // Override res.url on first response to point at /submissions, so the
    // classifier's success branch fires. The default mock can't set res.url,
    // but the classifier only uses finalUrl from meta, and we exercise that
    // path via the integration `submitToToi` which reads res.url. To keep this
    // test focused, we patch via Object.defineProperty after construction.
    const oldFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const r = await oldFetch(url, init);
      if (callCount === 1) {
        Object.defineProperty(r, "url", {
          value: "https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/A1-007/submissions",
        });
      }
      return r;
    }) as typeof fetch;

    const result = await submitToToi({
      baseUrl: "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
      cookie: "login",
      xsrf: "xsrf",
      extraHeaders: {},
      slug: "A1-007",
      language: "cpp",
      code: "int main(){}",
    });

    expect(result.submitted).toBe(false);
    expect(result.error).not.toBeNull();
    expect(result.error!.toLowerCase()).toContain("invalid submission format");
  });
});
