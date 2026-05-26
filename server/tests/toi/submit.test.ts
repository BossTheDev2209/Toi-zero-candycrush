import { describe, expect, test } from "bun:test";
import { buildCookieHeader, classifyToiSubmitResponse } from "../../src/toi/submit";

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
