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
  thinking: string | null;
  duration_ms: number | null;
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
  thinking?: string | null;
  durationMs?: number | null;
}

export function aiMessageRepo(db: Database) {
  const insertStmt = db.prepare(
    `INSERT INTO ai_message (problem_id, role, content, provider, model, tokens_in, tokens_out, thinking, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const listStmt = db.prepare(
    `SELECT * FROM ai_message WHERE problem_id = ? ORDER BY created_at, id`
  );
  const clearStmt = db.prepare(`DELETE FROM ai_message WHERE problem_id = ?`);
  const getByIdStmt = db.prepare(`SELECT * FROM ai_message WHERE id = ?`);
  const updateContentStmt = db.prepare(`UPDATE ai_message SET content = ? WHERE id = ?`);
  // Delete every later message in the same conversation. Used by edit-and-resend:
  // editing a user message invalidates the assistant reply that followed (and any
  // subsequent turns built on that reply), so we drop everything after the pivot.
  const deleteAfterStmt = db.prepare(`DELETE FROM ai_message WHERE problem_id = ? AND id > ?`);

  return {
    create(input: CreateAiMessageInput): number {
      const info = insertStmt.run(
        input.problemId, input.role, input.content,
        input.provider, input.model, input.tokensIn, input.tokensOut,
        input.thinking ?? null, input.durationMs ?? null,
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
    getById(id: number): AiMessageRow | null {
      const r = getByIdStmt.get(id) as AiMessageRow | undefined;
      return r ?? null;
    },
    updateContent(id: number, content: string): boolean {
      const info = updateContentStmt.run(content, id);
      return info.changes > 0;
    },
    deleteAfter(problemId: number, afterId: number): number {
      const info = deleteAfterStmt.run(problemId, afterId);
      return info.changes;
    },
  };
}
