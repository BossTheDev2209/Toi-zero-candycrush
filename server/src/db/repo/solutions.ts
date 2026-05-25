import type { Database } from "bun:sqlite";

export interface SolutionRow {
  id: number;
  problem_id: number;
  language: "c" | "cpp";
  code: string;
  updated_at: string;
}

export function solutionRepo(db: Database) {
  const select = db.prepare(`SELECT * FROM solution WHERE problem_id = ?`);
  const upsert = db.prepare(
    `INSERT INTO solution (problem_id, language, code) VALUES (?, ?, ?)
     ON CONFLICT(problem_id) DO UPDATE SET language=excluded.language, code=excluded.code, updated_at=datetime('now')`
  );

  return {
    get(problemId: number): SolutionRow | null {
      return (select.get(problemId) as SolutionRow | null) ?? null;
    },
    upsert(problemId: number, language: "c" | "cpp", code: string): void {
      upsert.run(problemId, language, code);
    },
  };
}
