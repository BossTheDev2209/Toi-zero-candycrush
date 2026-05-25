export interface CompareResult {
  ok: boolean;
  diff?: string;
}

function normalize(s: string): string[] {
  const lines = s.split(/\r?\n/).map((l) => l.replace(/[ \t]+$/g, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function compareOutputs(actual: string, expected: string): CompareResult {
  const a = normalize(actual);
  const e = normalize(expected);
  if (a.length !== e.length) {
    return { ok: false, diff: makeDiff(a, e) };
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== e[i]) return { ok: false, diff: makeDiff(a, e) };
  }
  return { ok: true };
}

function makeDiff(actual: string[], expected: string[]): string {
  const lines: string[] = [];
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    const a = actual[i] ?? "<EOF>";
    const e = expected[i] ?? "<EOF>";
    if (a === e) lines.push(`  ${a}`);
    else {
      lines.push(`- ${e}`);
      lines.push(`+ ${a}`);
    }
  }
  return lines.join("\n");
}
