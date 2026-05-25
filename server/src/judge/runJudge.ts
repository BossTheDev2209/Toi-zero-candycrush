import { compile } from "./compile";
import { execute } from "./execute";
import { compareOutputs } from "./compare";
import { makeWorkdir, cleanupWorkdir } from "./workdir";
import type { Language, Verdict } from "./verdicts";

export interface JudgeTest {
  idx: number;
  input: string;
  expected: string;
  subtask?: string;
}

export interface JudgeInput {
  language: Language;
  code: string;
  timeLimitMs: number;
  ioMode: string; // 'stdio' or 'file:<base>'
  tests: JudgeTest[];
}

export interface PerTestOutcome {
  idx: number;
  subtask: string;
  verdict: Verdict;
  runtimeMs: number;
  stderr: string;
  diff?: string;
}

export interface JudgeResult {
  verdict: Verdict;
  totalRuntimeMs: number;
  perTest: PerTestOutcome[];
  compileStderr?: string;
  subtaskScores?: Record<string, { passed: number; total: number }>;
}

const RANK: Record<Verdict, number> = { AC: 0, WA: 1, TLE: 2, RE: 3, CE: 4 };

function combineVerdict(a: Verdict, b: Verdict): Verdict {
  return RANK[b] > RANK[a] ? b : a;
}

function scoreSubtasks(perTest: PerTestOutcome[]): Record<string, { passed: number; total: number }> {
  const out: Record<string, { passed: number; total: number }> = {};
  for (const t of perTest) {
    const k = t.subtask;
    if (!out[k]) out[k] = { passed: 0, total: 0 };
    out[k]!.total += 1;
    if (t.verdict === "AC") out[k]!.passed += 1;
  }
  return out;
}

export async function runJudge(input: JudgeInput): Promise<JudgeResult> {
  const wd = await makeWorkdir();
  try {
    const c = await compile({ language: input.language, code: input.code, workdir: wd });
    if (!c.ok) {
      return { verdict: "CE", totalRuntimeMs: 0, perTest: [], compileStderr: c.stderr };
    }

    const perTest: PerTestOutcome[] = [];
    let total = 0;
    let worst: Verdict = "AC";

    for (const t of input.tests) {
      const r = await execute({
        binaryPath: c.binaryPath,
        stdin: input.ioMode === "stdio" ? t.input : "",
        timeoutMs: input.timeLimitMs,
        workdir: wd,
      });
      total += r.runtimeMs;

      let v: Verdict;
      let diff: string | undefined;
      if (r.timedOut) v = "TLE";
      else if (r.exit !== 0) v = "RE";
      else {
        const cmp = compareOutputs(r.stdout, t.expected);
        if (cmp.ok) v = "AC";
        else { v = "WA"; diff = cmp.diff; }
      }

      perTest.push({
        idx: t.idx,
        subtask: t.subtask ?? "main",
        verdict: v,
        runtimeMs: Math.round(r.runtimeMs),
        stderr: r.stderr.slice(0, 4000),
        diff: diff?.slice(0, 4000),
      });
      worst = combineVerdict(worst, v);
    }

    const subtaskScores = scoreSubtasks(perTest);
    return { verdict: worst, totalRuntimeMs: Math.round(total), perTest, subtaskScores };
  } finally {
    await cleanupWorkdir(wd);
  }
}
