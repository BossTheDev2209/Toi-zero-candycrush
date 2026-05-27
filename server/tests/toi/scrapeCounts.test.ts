import { describe, expect, test } from "bun:test";
import { parseCounts } from "../../src/toi/scrapeCounts";

const sampleHtml = `
<table>
  <thead><tr><th>Score</th><th>Task</th><th>Name</th><th>Time</th><th>Mem</th><th>Type</th><th>Files</th><th>นับ</th><th>pdf</th><th>submit</th></tr></thead>
  <tbody>
    <tr>
      <td>100 / 100</td>
      <td><a href="/00-pre-toi/tasks/A1-001/description">สวัสดี: ชื่อ</a></td>
      <td>1.000 second</td>
      <td>8.00 MiB</td>
      <td>Batch</td>
      <td>A1-001[.cpp|.c|.py]</td>
      <td>นับ</td>
      <td><a href="/00-pre-toi/tasks/A1-001/statements/TH">PDF</a></td>
      <td><button>ส่ง code</button></td>
    </tr>
    <tr>
      <td>0 / 100</td>
      <td><a href="/00-pre-toi/tasks/A1-002/description">แลกเปลี่ยน</a></td>
      <td>1.000 second</td>
      <td>8.00 MiB</td>
      <td>Batch</td>
      <td>A1-002[.cpp|.c|.py]</td>
      <td>ไม่นับ</td>
      <td>PDF</td>
      <td>ส่ง code</td>
    </tr>
    <tr>
      <td>0 / 100</td>
      <td><a href="/00-pre-toi/tasks/A2-005/description">x</a></td>
      <td>1</td><td>8</td><td>Batch</td><td>A2-005</td><td>นับ</td><td>PDF</td><td>submit</td>
    </tr>
  </tbody>
</table>
`;

describe("parseCounts", () => {
  test("extracts นับ/ไม่นับ per slug", () => {
    const counts = parseCounts(sampleHtml);
    expect(counts.size).toBe(3);
    expect(counts.get("A1-001")).toBe(1);
    expect(counts.get("A1-002")).toBe(0);
    expect(counts.get("A2-005")).toBe(1);
  });

  test("ignores rows without a task slug link", () => {
    const html = `<table><tr><td>x</td><td>y</td><td>z</td><td>a</td><td>b</td><td>c</td><td>นับ</td></tr></table>`;
    expect(parseCounts(html).size).toBe(0);
  });

  test("ignores rows where the counts cell is something else", () => {
    const html = `
      <table><tr>
        <td>0</td><td><a href="/00-pre-toi/tasks/A1-099/description">x</a></td>
        <td>1</td><td>2</td><td>3</td><td>4</td><td>Unknown</td><td>PDF</td>
      </tr></table>
    `;
    expect(parseCounts(html).size).toBe(0);
  });
});
