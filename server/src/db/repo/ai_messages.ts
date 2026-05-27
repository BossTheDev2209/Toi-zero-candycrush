import type { Database } from "bun:sqlite";

export interface AiMessageRow {
  id: number;
  problem_id: number;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface CreateAiMessageInput {
  problemId: number;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
}

export function aiMessageRepo(db: Database) {
  const insertStmt = db.prepare(
    `INSERT INTO ai_message (problem_id, role, content, provider, model, tokens_in, tokens_out)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const listStmt = db.prepare(
    `SELECT * FROM ai_message WHERE problem_id = ? ORDER BY created_at, id`
  );
  const clearStmt = db.prepare(`DELETE FROM ai_message WHERE problem_id = ?`);

  return {
    create(input: CreateAiMessageInput): number {
      const info = insertStmt.run(
        input.problemId, input.role, input.content,
        input.provider, input.model, input.tokensIn, input.tokensOut
      );
      return Number(info.lastInsertRowid);
    },
    listForProblem(problemId: number): AiMessageRow[] {
      return listStmt.all(problemId) as AiMessageRow[];
    },
    clearForProblem(problemId: number): number {
      const info = clearStmt.run(problemId);
      return info.changes;
    },
  };
}
