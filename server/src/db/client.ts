import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function openDb(path: string): Database {
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  const cols = db.query("PRAGMA table_info(problem)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "toi_best_score")) {
    db.exec("ALTER TABLE problem ADD COLUMN toi_best_score INTEGER NOT NULL DEFAULT 0;");
    db.exec("ALTER TABLE problem ADD COLUMN toi_last_sync_at TEXT;");
  }
  return db;
}
