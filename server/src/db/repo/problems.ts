import type { Database } from "bun:sqlite";

export interface CreateProblemInput {
  slug: string;
  title: string;
  statementMd: string;
  inputMd: string;
  outputMd: string;
  category: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  ioMode: string;
  sourceUrl: string;
  sampleTests: { input: string; expected: string; explanationMd: string }[];
  extraTests: { input: string; expected: string; subtask: string }[];
}

export interface ProblemRow {
  id: number;
  slug: string;
  title: string;
  statement_md: string;
  input_md: string;
  output_md: string;
  category: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  io_mode: string;
  source_url: string;
  created_at: string;
  updated_at: string;
}

export interface TestRow {
  id: number;
  problem_id: number;
  kind: "sample" | "extra";
  subtask: string;
  idx: number;
  input_text: string;
  expected_text: string;
  explanation_md: string;
}

export function problemRepo(db: Database) {
  const insertProblem = db.prepare(
    `INSERT INTO problem (slug, title, statement_md, input_md, output_md, category, time_limit_ms, memory_limit_mb, io_mode, source_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTest = db.prepare(
    `INSERT INTO test_case (problem_id, kind, subtask, idx, input_text, expected_text, explanation_md)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const selectById = db.prepare(`SELECT * FROM problem WHERE id = ?`);
  const selectAll = db.prepare(`SELECT * FROM problem ORDER BY created_at DESC, id DESC`);
  const selectTests = db.prepare(`SELECT * FROM test_case WHERE problem_id = ? ORDER BY kind, subtask, idx`);
  const updateProblem = db.prepare(
    `UPDATE problem SET title=?, statement_md=?, input_md=?, output_md=?, category=?, time_limit_ms=?, memory_limit_mb=?, io_mode=?, source_url=?, updated_at=datetime('now') WHERE id=?`
  );
  const deleteTests = db.prepare(`DELETE FROM test_case WHERE problem_id = ?`);
  const deleteProblem = db.prepare(`DELETE FROM problem WHERE id = ?`);

  return {
    create(input: CreateProblemInput): number {
      const tx = db.transaction(() => {
        const info = insertProblem.run(
          input.slug, input.title, input.statementMd, input.inputMd, input.outputMd,
          input.category, input.timeLimitMs, input.memoryLimitMb, input.ioMode, input.sourceUrl
        );
        const id = Number(info.lastInsertRowid);
        input.sampleTests.forEach((t, i) => {
          insertTest.run(id, "sample", "main", i, t.input, t.expected, t.explanationMd);
        });
        input.extraTests.forEach((t, i) => {
          insertTest.run(id, "extra", t.subtask || "main", i, t.input, t.expected, "");
        });
        return id;
      });
      return tx();
    },

    getById(id: number): ProblemRow | null {
      return (selectById.get(id) as ProblemRow | null) ?? null;
    },

    listAll(): ProblemRow[] {
      return selectAll.all() as ProblemRow[];
    },

    getTests(id: number): { samples: TestRow[]; extras: TestRow[] } {
      const rows = selectTests.all(id) as TestRow[];
      return {
        samples: rows.filter((r) => r.kind === "sample"),
        extras: rows.filter((r) => r.kind === "extra"),
      };
    },

    update(id: number, input: CreateProblemInput): boolean {
      const tx = db.transaction(() => {
        const info = updateProblem.run(
          input.title, input.statementMd, input.inputMd, input.outputMd, input.category,
          input.timeLimitMs, input.memoryLimitMb, input.ioMode, input.sourceUrl, id
        );
        if (info.changes === 0) return false;
        deleteTests.run(id);
        input.sampleTests.forEach((t, i) => {
          insertTest.run(id, "sample", "main", i, t.input, t.expected, t.explanationMd);
        });
        input.extraTests.forEach((t, i) => {
          insertTest.run(id, "extra", t.subtask || "main", i, t.input, t.expected, "");
        });
        return true;
      });
      return tx();
    },

    delete(id: number): boolean {
      const info = deleteProblem.run(id);
      return info.changes > 0;
    },
  };
}
