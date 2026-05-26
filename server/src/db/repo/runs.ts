import type { Database } from "bun:sqlite";
import type { Language } from "../../judge/verdicts";

export type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE";

export interface PerTestResult {
  idx: number;
  verdict: Verdict;
  runtimeMs: number;
  stderr: string;
  diff?: string;
}

export interface CreateRunInput {
  problemId: number;
  language: Language;
  codeSnapshot: string;
  verdict: Verdict;
  totalRuntimeMs: number;
  perTest: PerTestResult[];
}

export interface RunRow {
  id: number;
  problem_id: number;
  language: Language;
  code_snapshot: string;
  verdict: Verdict;
  total_runtime_ms: number;
  per_test_json: string;
  created_at: string;
}

export function runRepo(db: Database) {
  const insert = db.prepare(
    `INSERT INTO run (problem_id, language, code_snapshot, verdict, total_runtime_ms, per_test_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const selectRecent = db.prepare(
    `SELECT * FROM run WHERE problem_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`
  );

  return {
    create(input: CreateRunInput): number {
      const info = insert.run(
        input.problemId, input.language, input.codeSnapshot,
        input.verdict, input.totalRuntimeMs, JSON.stringify(input.perTest)
      );
      return Number(info.lastInsertRowid);
    },
    listRecent(problemId: number, limit: number): RunRow[] {
      return selectRecent.all(problemId, limit) as RunRow[];
    },
  };
}
