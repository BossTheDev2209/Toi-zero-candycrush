CREATE TABLE IF NOT EXISTS problem (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  statement_md TEXT NOT NULL DEFAULT '',
  input_md     TEXT NOT NULL DEFAULT '',
  output_md    TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'general',
  time_limit_ms   INTEGER NOT NULL DEFAULT 1000,
  memory_limit_mb INTEGER NOT NULL DEFAULT 256,
  io_mode      TEXT NOT NULL DEFAULT 'stdio' CHECK (io_mode = 'stdio' OR io_mode LIKE 'file:%'),
  source_url   TEXT NOT NULL DEFAULT '',
  toi_best_score INTEGER NOT NULL DEFAULT 0,
  toi_last_sync_at TEXT,
  toi_previous_year INTEGER NOT NULL DEFAULT 0,
  toi_previous_year_note TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_case (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id    INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('sample', 'extra')),
  subtask       TEXT NOT NULL DEFAULT 'main',
  idx           INTEGER NOT NULL,
  input_text    TEXT NOT NULL,
  expected_text TEXT NOT NULL,
  explanation_md TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_test_case_problem ON test_case(problem_id);

CREATE TABLE IF NOT EXISTS solution (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL UNIQUE REFERENCES problem(id) ON DELETE CASCADE,
  language   TEXT NOT NULL CHECK (language IN ('c', 'cpp')),
  code       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS run (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id      INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
  language        TEXT NOT NULL CHECK (language IN ('c', 'cpp')),
  code_snapshot   TEXT NOT NULL,
  verdict         TEXT NOT NULL CHECK (verdict IN ('AC', 'WA', 'TLE', 'RE', 'CE')),
  total_runtime_ms INTEGER NOT NULL DEFAULT 0,
  per_test_json   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_run_problem ON run(problem_id, created_at DESC);

CREATE TABLE IF NOT EXISTS toi_submission (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id    INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
  language      TEXT NOT NULL CHECK (language IN ('c', 'cpp')),
  code_snapshot TEXT NOT NULL,
  http_status   INTEGER,
  response_json TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
