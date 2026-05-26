import { describe, expect, test } from "bun:test";
import { isLoginHtml, parseBestScore } from "../../src/toi/scrapeScores";

describe("parseBestScore", () => {
  test("extracts max score from TOI submission rows", () => {
    const html = `
      <table>
        <tr data-submission="1"><td>ignored</td><td>76 / 100</td></tr>
        <tr data-submission="2"><td>ignored</td><td>100 / 100</td></tr>
        <tr data-submission="3"><td>ignored</td><td>82 / 100</td></tr>
      </table>
    `;
    expect(parseBestScore(html)).toBe(100);
  });

  test("returns zero when no scores are present", () => {
    expect(parseBestScore("<table><tr><td>No submissions</td></tr></table>")).toBe(0);
  });
});

describe("isLoginHtml", () => {
  test("detects expired TOI session pages", () => {
    expect(isLoginHtml("<html>Please log in</html>")).toBe(true);
    expect(isLoginHtml("<form action='/login'>Login</form>")).toBe(true);
    expect(isLoginHtml("<tr data-submission='1'><td>100 / 100</td></tr>")).toBe(false);
  });
});
