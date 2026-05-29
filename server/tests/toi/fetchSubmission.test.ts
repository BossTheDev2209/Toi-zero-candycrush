import { describe, expect, test } from "bun:test";
import { parseBestSubmission } from "../../src/toi/fetchSubmission";

// Captured from a live TOI submissions page (2026-05-29). Rows are newest-first.
const html = `
<table>
  <thead><tr><th>Date and time</th><th>Status</th><th>Score</th><th>Files</th></tr></thead>
  <tbody>
    <tr data-submission="7" data-status="5">
      <td class="datetime">May 26, 2026, 10:05:59 PM</td>
      <td class="status">Evaluated <a class="details">details</a></td>
      <td class="public_score score_100">100 / 100</td>
      <td class="files"><a class="btn" href="../../../00-pre-toi/tasks/A1-001/submissions/7/files/A1-001.cpp">Download</a></td>
    </tr>
    <tr data-submission="3" data-status="5">
      <td class="datetime">Mar 17, 2026, 3:33:08 PM</td>
      <td class="status">Evaluated <a class="details">details</a></td>
      <td class="public_score score_0">0 / 100</td>
      <td class="files"><a class="btn" href="../../../00-pre-toi/tasks/A1-001/submissions/3/files/A1-001.cpp">Download</a></td>
    </tr>
  </tbody>
</table>
`;

describe("parseBestSubmission", () => {
  test("picks the highest-scoring submission and reads its language", () => {
    const best = parseBestSubmission(html);
    expect(best).not.toBeNull();
    expect(best!.id).toBe(7);
    expect(best!.score).toBe(100);
    expect(best!.language).toBe("cpp");
    expect(best!.filename).toBe("A1-001.cpp");
  });

  test("breaks score ties by latest (highest) submission id", () => {
    const tie = `
      <table><tbody>
        <tr data-submission="5"><td class="public_score score_80">80 / 100</td>
          <td><a href="../../../00-pre-toi/tasks/A2-003/submissions/5/files/A2-003.py">Download</a></td></tr>
        <tr data-submission="9"><td class="public_score score_80">80 / 100</td>
          <td><a href="../../../00-pre-toi/tasks/A2-003/submissions/9/files/A2-003.py">Download</a></td></tr>
      </tbody></table>`;
    const best = parseBestSubmission(tie);
    expect(best!.id).toBe(9);
    expect(best!.language).toBe("py");
  });

  test("returns null when there are no downloadable submissions", () => {
    expect(parseBestSubmission("<table><tbody><tr><td>No submissions</td></tr></tbody></table>")).toBeNull();
  });

  test("maps .c to c and ignores unsupported extensions", () => {
    const cOnly = `<table><tbody>
      <tr data-submission="2"><td class="public_score score_50">50 / 100</td>
        <td><a href="../../../00-pre-toi/tasks/A1-009/submissions/2/files/A1-009.c">Download</a></td></tr>
    </tbody></table>`;
    expect(parseBestSubmission(cOnly)!.language).toBe("c");

    const javaOnly = `<table><tbody>
      <tr data-submission="2"><td class="public_score score_50">50 / 100</td>
        <td><a href="../../../00-pre-toi/tasks/A1-009/submissions/2/files/A1-009.java">Download</a></td></tr>
    </tbody></table>`;
    expect(parseBestSubmission(javaOnly)).toBeNull();
  });
});
