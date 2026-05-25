import type { Database } from "bun:sqlite";

export interface CreateToiSubmissionInput {
  problemId: number;
  language: "c" | "cpp";
  codeSnapshot: string;
  httpStatus: number | null;
  responseJson: string | null;
  error: string | null;
}

export function toiSubmissionRepo(db: Database) {
  const insert = db.prepare(
    `INSERT INTO toi_submission (problem_id, language, code_snapshot, http_status, response_json, error)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  return {
    create(input: CreateToiSubmissionInput): number {
      const info = insert.run(
        input.problemId, input.language, input.codeSnapshot,
        input.httpStatus, input.responseJson, input.error
      );
      return Number(info.lastInsertRowid);
    },
  };
}
