import type { Verdict } from "../lib/types";

export const VERDICTS: Array<{
  code: Verdict;
  name: string;
  meaning: string;
  fix: string;
  color: string;
}> = [
  {
    code: "AC",
    name: "Accepted",
    meaning: "Output matches expected, within time and memory limits.",
    fix: "Nothing: your code passed this test.",
    color: "var(--color-success)",
  },
  {
    code: "WA",
    name: "Wrong Answer",
    meaning: "Code compiled and ran, but the output is different from expected.",
    fix: "Check the diff. Fix the logic or edge cases.",
    color: "var(--color-danger)",
  },
  {
    code: "TLE",
    name: "Time Limit Exceeded",
    meaning: "Code took longer than the allowed time (default 1000 ms).",
    fix: "Use a faster algorithm or smaller data structure.",
    color: "var(--color-warning)",
  },
  {
    code: "RE",
    name: "Runtime Error",
    meaning: "Code crashed: segfault, divide by zero, out-of-bounds, etc.",
    fix: "Check array indices, nullptrs, division by zero.",
    color: "var(--color-danger)",
  },
  {
    code: "CE",
    name: "Compile Error",
    meaning: "g++ / gcc couldn't compile your source.",
    fix: "Read the compiler stderr, then fix syntax or missing includes.",
    color: "var(--color-graphite)",
  },
];

export function VerdictGlossary({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {VERDICTS.map((v) => (
          <span
            key={v.code}
            title={`${v.name}: ${v.meaning}`}
            className="motion-press inline-flex items-center gap-1.5 rounded-full border border-[var(--color-dust)] bg-white px-3 py-1 text-xs"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />
            <span className="font-medium">{v.code}</span>
            <span className="text-[var(--color-slate)]">{v.name}</span>
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="motion-surface rounded-[24px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-6">
      <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-3">
        Verdicts
      </div>
      <ul className="space-y-3">
        {VERDICTS.map((v) => (
          <li key={v.code} className="result-card flex items-start gap-3 rounded-[18px] px-2 py-1.5">
            <span className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.color }} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{v.code}</span>
                <span className="text-sm text-[var(--color-slate)]">{v.name}</span>
              </div>
              <p className="text-sm text-[var(--color-ink)] mt-0.5">{v.meaning}</p>
              <p className="mt-0.5 text-xs text-[var(--color-slate)]">Fix: {v.fix}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
