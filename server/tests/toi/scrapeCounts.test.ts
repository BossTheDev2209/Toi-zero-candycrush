import { describe, expect, test } from "bun:test";
import { parseCounts } from "../../src/toi/scrapeCounts";

// Layout A — current 00-pre-toi (captured live 2026-05-29).
// Slug is in <th>, NO นับ/ไม่นับ column at all → every row defaults to counts=1.
const currentLayoutHtml = `
<table>
  <thead><tr><th>Score</th><th>Task</th><th>Name</th><th>Time limit</th><th>Memory limit</th><th>Type</th><th>Files</th></tr></thead>
  <tbody>
    <tr>
      <td class="public_score score_100">100 / 100</td>
      <th>A1-001</th>
      <td>สวัสดี: ชื่อ</td>
      <td>1.000 second</td>
      <td>8.00 MiB</td>
      <td>Batch</td>
      <td>A1-001[.cpp|.c|.py]</td>
    </tr>
    <tr>
      <td class="public_score score_0">0 / 100</td>
      <th>A1-002</th>
      <td>แลกเปลี่ยนเงิน</td>
      <td>1.000 second</td>
      <td>8.00 MiB</td>
      <td>Batch</td>
      <td>A1-002[.cpp|.c|.py]</td>
    </tr>
  </tbody>
</table>
`;

// Layout B — older anchor + นับ/ไม่นับ layout. Still in production on some TOI
// instances, kept supported so the parser stays portable.
const legacyLayoutHtml = `
<table>
  <tbody>
    <tr>
      <td>100 / 100</td>
      <td><a href="/00-pre-toi/tasks/A1-101/description">x</a></td>
      <td>1.000 second</td><td>8.00 MiB</td><td>Batch</td><td>A1-101[.cpp]</td>
      <td>นับ</td>
    </tr>
    <tr>
      <td>0 / 100</td>
      <td><a href="/00-pre-toi/tasks/A1-102/description">y</a></td>
      <td>1.000 second</td><td>8.00 MiB</td><td>Batch</td><td>A1-102[.cpp]</td>
      <td>ไม่นับ</td>
    </tr>
  </tbody>
</table>
`;

describe("parseCounts", () => {
  test("current layout (no counts column) emits no rows — user toggles aren't clobbered", () => {
    // Slug is matched (we recognize the <th> form), but with no explicit
    // นับ / ไม่นับ in any cell, parseCounts intentionally omits the row so
    // /sync-counts can't overwrite a manual `toi_counts` toggle.
    const counts = parseCounts(currentLayoutHtml);
    expect(counts.size).toBe(0);
  });

  test("legacy layout: explicit ไม่นับ flips to 0", () => {
    const counts = parseCounts(legacyLayoutHtml);
    expect(counts.size).toBe(2);
    expect(counts.get("A1-101")).toBe(1);
    expect(counts.get("A1-102")).toBe(0);
  });

  test("ignores rows that have neither a <th> slug nor a /tasks/ link", () => {
    expect(parseCounts("<table><tr><td>x</td><td>y</td><td>z</td></tr></table>").size).toBe(0);
  });

  test("ignores header rows (slug-shape filter rejects <th>Score</th>)", () => {
    const headerOnly = "<table><thead><tr><th>Score</th><th>Task</th></tr></thead></table>";
    expect(parseCounts(headerOnly).size).toBe(0);
  });
});
