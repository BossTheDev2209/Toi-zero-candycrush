import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function migrateLanguageChecks(db: Database): void {
  const tables = ["solution", "run", "toi_submission"] as const;
  const needsMigration = tables.some((table) => {
    const row = db.query("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table) as { sql: string } | null;
    return row?.sql.includes("'py'") === false;
  });
  if (!needsMigration) return;

  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;

    CREATE TABLE solution_new (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL UNIQUE REFERENCES problem(id) ON DELETE CASCADE,
      language   TEXT NOT NULL CHECK (language IN ('c', 'cpp', 'py')),
      code       TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO solution_new (id, problem_id, language, code, updated_at)
      SELECT id, problem_id, language, code, updated_at FROM solution;
    DROP TABLE solution;
    ALTER TABLE solution_new RENAME TO solution;

    CREATE TABLE run_new (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id      INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
      language        TEXT NOT NULL CHECK (language IN ('c', 'cpp', 'py')),
      code_snapshot   TEXT NOT NULL,
      verdict         TEXT NOT NULL CHECK (verdict IN ('AC', 'WA', 'TLE', 'RE', 'CE')),
      total_runtime_ms INTEGER NOT NULL DEFAULT 0,
      per_test_json   TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO run_new (id, problem_id, language, code_snapshot, verdict, total_runtime_ms, per_test_json, created_at)
      SELECT id, problem_id, language, code_snapshot, verdict, total_runtime_ms, per_test_json, created_at FROM run;
    DROP TABLE run;
    ALTER TABLE run_new RENAME TO run;
    CREATE INDEX IF NOT EXISTS idx_run_problem ON run(problem_id, created_at DESC);

    CREATE TABLE toi_submission_new (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id    INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
      language      TEXT NOT NULL CHECK (language IN ('c', 'cpp', 'py')),
      code_snapshot TEXT NOT NULL,
      http_status   INTEGER,
      response_json TEXT,
      error         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO toi_submission_new (id, problem_id, language, code_snapshot, http_status, response_json, error, created_at)
      SELECT id, problem_id, language, code_snapshot, http_status, response_json, error, created_at FROM toi_submission;
    DROP TABLE toi_submission;
    ALTER TABLE toi_submission_new RENAME TO toi_submission;

    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

export function openDb(path: string): Database {
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  const cols = db.query("PRAGMA table_info(problem)").all() as { name: string }[];
  const hasCol = (name: string) => cols.some((c) => c.name === name);
  if (!hasCol("toi_best_score")) {
    db.exec("ALTER TABLE problem ADD COLUMN toi_best_score INTEGER NOT NULL DEFAULT 0;");
  }
  if (!hasCol("toi_last_sync_at")) {
    db.exec("ALTER TABLE problem ADD COLUMN toi_last_sync_at TEXT;");
  }
  if (!hasCol("toi_previous_year")) {
    db.exec("ALTER TABLE problem ADD COLUMN toi_previous_year INTEGER NOT NULL DEFAULT 0;");
  }
  if (!hasCol("toi_previous_year_note")) {
    db.exec("ALTER TABLE problem ADD COLUMN toi_previous_year_note TEXT NOT NULL DEFAULT '';");
  }
  if (!hasCol("toi_counts")) {
    db.exec("ALTER TABLE problem ADD COLUMN toi_counts INTEGER NOT NULL DEFAULT 1;");
  }
  const hasAiMessage = (db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_message'").get() as { name: string } | null);
  if (!hasAiMessage) {
    db.exec(`
      CREATE TABLE ai_message (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id  INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
        role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content     TEXT NOT NULL,
        provider    TEXT,
        model       TEXT,
        tokens_in   INTEGER,
        tokens_out  INTEGER,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_ai_message_problem ON ai_message(problem_id, created_at);
    `);
  }
  migrateLanguageChecks(db);
  return db;
}
