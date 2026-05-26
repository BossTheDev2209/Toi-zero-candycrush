import { describe, expect, test } from "bun:test";
import { isExpiredLoginHtml } from "../../src/toi/fetchPdf";

describe("isExpiredLoginHtml", () => {
  test("detects HTML login responses masquerading as successful PDF fetches", () => {
    expect(isExpiredLoginHtml("text/html; charset=utf-8", "<html>Please log in</html>")).toBe(true);
    expect(isExpiredLoginHtml("text/html", "<html><form action='/login'></form></html>")).toBe(true);
  });

  test("allows real PDF responses", () => {
    expect(isExpiredLoginHtml("application/pdf", "%PDF-1.7\nbody")).toBe(false);
  });
});
