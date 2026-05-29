export type Language = "c" | "cpp" | "py";
export type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE";

export interface Problem {
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
  toi_best_score: number;
  toi_last_sync_at: string | null;
  toi_previous_year: 0 | 1;
  toi_previous_year_note: string;
  toi_counts: 0 | 1;
  has_pdf?: boolean;
  local_run_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Qualification {
  a1Count: number;
  a2a3Count: number;
  qualified: boolean;
}

export interface ScoreSyncProgress {
  running: boolean;
  total: number;
  done: number;
  /** Count of problems whose stored best score was actually raised by this sync. */
  updated: number;
  failed: { slug: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
  /**
   * ISO timestamp of the most recent per-problem sync (MAX(toi_last_sync_at)
   * from the DB), or null when no problem has ever been synced. Survives
   * server restarts; the client uses this to throttle the auto-sync-on-mount.
   */
  lastSyncAt: string | null;
}

export interface PdfSyncProgress {
  running: boolean;
  total: number;
  done: number;
  synced: number;
  skipped: number;
  failed: { slug: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
}

export type ProblemSortMode = "slug" | "score" | "status" | "unsolved-first";
export type ProblemFilterMode = "all" | "unsolved" | "80+" | "100" | "counted" | "uncounted";

export interface TestCase {
  id: number;
  problem_id: number;
  kind: "sample" | "extra";
  subtask: string;
  idx: number;
  input_text: string;
  expected_text: string;
  explanation_md: string;
}

export interface ProblemDetail extends Problem {
  tests: { samples: TestCase[]; extras: TestCase[] };
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

export interface RunRow {
  id: number;
  problem_id: number;
  language: Language;
  verdict: Verdict;
  total_runtime_ms: number;
  per_test_json: string;
  created_at: string;
}
