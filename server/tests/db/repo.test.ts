import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDb } from "../../src/db/client";
import { problemRepo } from "../../src/db/repo/problems";
import { solutionRepo } from "../../src/db/repo/solutions";
import { runRepo } from "../../src/db/repo/runs";
import { aiMessageRepo } from "../../src/db/repo/ai_messages";

describe("problemRepo", () => {
  test("creates and retrieves a problem with sample tests", () => {
    const db = openDb(":memory:");
    const repo = problemRepo(db);

    const id = repo.create({
      slug: "addition",
      title: "Add Two Numbers",
      statementMd: "Given a, b, output a+b.",
      inputMd: "Two integers a, b.",
      outputMd: "Their sum.",
      category: "basics",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      ioMode: "stdio",
      sourceUrl: "https://toi.example/p/addition",
      sampleTests: [
        { input: "1 2\n", expected: "3\n", explanationMd: "" },
        { input: "10 20\n", expected: "30\n", explanationMd: "" },
      ],
      extraTests: [],
    });

    const p = repo.getById(id);
    expect(p).not.toBeNull();
    expect(p!.slug).toBe("addition");
    expect(p!.title).toBe("Add Two Numbers");

    const tests = repo.getTests(id);
    expect(tests.samples.length).toBe(2);
    expect(tests.samples[0]!.input_text).toBe("1 2\n");
    expect(tests.samples[1]!.expected_text).toBe("30\n");
  });

  test("listAll returns problems ordered by created_at desc", () => {
    const db = openDb(":memory:");
    const repo = problemRepo(db);
    repo.create({ slug: "a", title: "A", statementMd: "", inputMd: "", outputMd: "", category: "x", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "", sampleTests: [], extraTests: [] });
    repo.create({ slug: "b", title: "B", statementMd: "", inputMd: "", outputMd: "", category: "x", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "", sampleTests: [], extraTests: [] });
    const list = repo.listAll();
    expect(list.length).toBe(2);
    expect(list.map((p) => p.slug)).toEqual(["b", "a"]);
  });

  test("getById returns null for unknown id", () => {
    const db = openDb(":memory:");
    expect(problemRepo(db).getById(9999)).toBeNull();
  });

  test("update replaces problem fields and tests, returns true; false for unknown id", () => {
    const db = openDb(":memory:");
    const repo = problemRepo(db);
    const id = repo.create({
      slug: "a", title: "Old", statementMd: "old", inputMd: "", outputMd: "", category: "x",
      timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "",
      sampleTests: [{ input: "1\n", expected: "1\n", explanationMd: "" }],
      extraTests: [],
    });
    const ok = repo.update(id, {
      slug: "a", title: "New", statementMd: "new", inputMd: "", outputMd: "", category: "y",
      timeLimitMs: 2000, memoryLimitMb: 512, ioMode: "stdio", sourceUrl: "",
      sampleTests: [{ input: "2\n", expected: "2\n", explanationMd: "" }],
      extraTests: [],
    });
    expect(ok).toBe(true);
    const p = repo.getById(id);
    expect(p!.title).toBe("New");
    expect(p!.time_limit_ms).toBe(2000);
    const tests = repo.getTests(id);
    expect(tests.samples.length).toBe(1);
    expect(tests.samples[0]!.input_text).toBe("2\n");

    expect(repo.update(9999, {
      slug: "x", title: "x", statementMd: "", inputMd: "", outputMd: "", category: "x",
      timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "",
      sampleTests: [], extraTests: [],
    })).toBe(false);
  });

  test("delete cascades to tests, solutions, and runs", () => {
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const sRepo = solutionRepo(db);
    const rRepo = runRepo(db);
    const id = pRepo.create({
      slug: "a", title: "A", statementMd: "", inputMd: "", outputMd: "", category: "x",
      timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "",
      sampleTests: [{ input: "x", expected: "x", explanationMd: "" }],
      extraTests: [],
    });
    sRepo.upsert(id, "py", "print('ok')");
    rRepo.create({ problemId: id, language: "cpp", codeSnapshot: "x", verdict: "AC", totalRuntimeMs: 0, perTest: [] });

    expect(pRepo.delete(id)).toBe(true);
    expect(pRepo.getById(id)).toBeNull();
    expect(pRepo.getTests(id).samples.length).toBe(0);
    expect(sRepo.get(id)).toBeNull();
    expect(rRepo.listRecent(id, 5).length).toBe(0);

    expect(pRepo.delete(9999)).toBe(false);
  });

  test("tracks TOI best score and qualification counts", () => {
    const db = openDb(":memory:");
    const repo = problemRepo(db);
    const a1Ids = Array.from({ length: 21 }, (_, i) =>
      repo.create({
        slug: `A1-${String(i + 1).padStart(3, "0")}`,
        title: `A1 ${i + 1}`,
        statementMd: "",
        inputMd: "",
        outputMd: "",
        category: "A1",
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        ioMode: "stdio",
        sourceUrl: "",
        sampleTests: [],
        extraTests: [],
      })
    );
    const a2Ids = Array.from({ length: 20 }, (_, i) =>
      repo.create({
        slug: `A2-${String(i + 1).padStart(3, "0")}`,
        title: `A2 ${i + 1}`,
        statementMd: "",
        inputMd: "",
        outputMd: "",
        category: "A2",
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        ioMode: "stdio",
        sourceUrl: "",
        sampleTests: [],
        extraTests: [],
      })
    );

    const first = repo.getById(a1Ids[0]!);
    expect(first!.toi_best_score).toBe(0);
    expect(first!.toi_last_sync_at).toBeNull();

    expect(repo.updateToiScore(a1Ids[0]!, 75, "2026-05-26T00:00:00.000Z")).toBe(true);
    expect(repo.getById(a1Ids[0]!)!.toi_best_score).toBe(75);
    expect(repo.updateToiScore(a1Ids[0]!, 40, "2026-05-26T01:00:00.000Z")).toBe(true);
    expect(repo.getById(a1Ids[0]!)!.toi_best_score).toBe(75);
    expect(repo.updateToiScore(9999, 100, "2026-05-26T02:00:00.000Z")).toBe(false);

    for (const id of a1Ids.slice(1, 20)) repo.updateToiScore(id, 80, "2026-05-26T03:00:00.000Z");
    for (const id of a2Ids) repo.updateToiScore(id, 100, "2026-05-26T04:00:00.000Z");

    expect(repo.qualification()).toEqual({ a1Count: 19, a2a3Count: 20, qualified: false });
    repo.updateToiScore(a1Ids[0]!, 80, "2026-05-26T05:00:00.000Z");
    expect(repo.qualification()).toEqual({ a1Count: 20, a2a3Count: 20, qualified: true });
  });

  test("tracks previous-year flag without excluding qualification", () => {
    const db = openDb(":memory:");
    const repo = problemRepo(db);
    const id = repo.create({
      slug: "A1-099",
      title: "Old AC",
      statementMd: "",
      inputMd: "",
      outputMd: "",
      category: "A1",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      ioMode: "stdio",
      sourceUrl: "",
      sampleTests: [],
      extraTests: [],
    });

    expect(repo.getById(id)!.toi_previous_year).toBe(0);
    expect(repo.getById(id)!.toi_previous_year_note).toBe("");
    expect(repo.updateProgressFlags(id, { toiPreviousYear: true, toiPreviousYearNote: "solved in 2025" })).toBe(true);
    expect(repo.updateProgressFlags(9999, { toiPreviousYear: true, toiPreviousYearNote: "" })).toBe(false);

    repo.updateToiScore(id, 100, "2026-05-27T00:00:00.000Z");
    const row = repo.getById(id)!;
    expect(row.toi_previous_year).toBe(1);
    expect(row.toi_previous_year_note).toBe("solved in 2025");
    expect(repo.qualification()).toEqual({ a1Count: 1, a2a3Count: 0, qualified: false });
  });

  test("toi_counts defaults to 1 and excludes qualification when 0", () => {
    const db = openDb(":memory:");
    const repo = problemRepo(db);
    const id = repo.create({
      slug: "A1-200", title: "Uncounted AC", statementMd: "", inputMd: "", outputMd: "",
      category: "A1", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "",
      sampleTests: [], extraTests: [],
    });

    expect(repo.getById(id)!.toi_counts).toBe(1);
    repo.updateToiScore(id, 100, "2026-05-27T00:00:00.000Z");
    expect(repo.qualification()).toEqual({ a1Count: 1, a2a3Count: 0, qualified: false });

    expect(repo.updateCounts(id, false)).toBe(true);
    expect(repo.updateCounts(9999, false)).toBe(false);
    expect(repo.getById(id)!.toi_counts).toBe(0);
    expect(repo.qualification()).toEqual({ a1Count: 0, a2a3Count: 0, qualified: false });

    repo.updateCounts(id, true);
    expect(repo.getById(id)!.toi_counts).toBe(1);
    expect(repo.qualification()).toEqual({ a1Count: 1, a2a3Count: 0, qualified: false });
  });

  test("migrates older problem tables with previous-year columns", () => {
    const dir = mkdtempSync(join(tmpdir(), "toizero-migration-"));
    const path = join(dir, "old.db");
    try {
      const oldDb = new Database(path, { create: true });
      oldDb.exec(`
        CREATE TABLE problem (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          statement_md TEXT NOT NULL DEFAULT '',
          input_md TEXT NOT NULL DEFAULT '',
          output_md TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'general',
          time_limit_ms INTEGER NOT NULL DEFAULT 1000,
          memory_limit_mb INTEGER NOT NULL DEFAULT 256,
          io_mode TEXT NOT NULL DEFAULT 'stdio',
          source_url TEXT NOT NULL DEFAULT '',
          toi_best_score INTEGER NOT NULL DEFAULT 0,
          toi_last_sync_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      oldDb.close();

      const migrated = openDb(path);
      const cols = migrated.query("PRAGMA table_info(problem)").all() as { name: string }[];
      expect(cols.some((c) => c.name === "toi_previous_year")).toBe(true);
      expect(cols.some((c) => c.name === "toi_previous_year_note")).toBe(true);
      migrated.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("solutionRepo", () => {
  test("upserts solution per problem", () => {
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const id = pRepo.create({ slug: "a", title: "A", statementMd: "", inputMd: "", outputMd: "", category: "x", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "", sampleTests: [], extraTests: [] });

    const sRepo = solutionRepo(db);
    sRepo.upsert(id, "cpp", "int main(){}");
    expect(sRepo.get(id)?.code).toBe("int main(){}");
    sRepo.upsert(id, "py", "print('ok')");
    expect(sRepo.get(id)?.language).toBe("py");
    expect(sRepo.get(id)?.code).toBe("print('ok')");
  });
});

describe("runRepo", () => {
  test("creates a run and lists recent runs", () => {
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const id = pRepo.create({ slug: "a", title: "A", statementMd: "", inputMd: "", outputMd: "", category: "x", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "", sampleTests: [], extraTests: [] });

    const rRepo = runRepo(db);
    const runId = rRepo.create({
      problemId: id,
      language: "cpp",
      codeSnapshot: "int main(){}",
      verdict: "AC",
      totalRuntimeMs: 42,
      perTest: [{ idx: 0, verdict: "AC", runtimeMs: 42, stderr: "" }],
    });
    expect(runId).toBeGreaterThan(0);
    const recent = rRepo.listRecent(id, 5);
    expect(recent.length).toBe(1);
    expect(recent[0]!.verdict).toBe("AC");
  });

  test("accepts Python run rows", () => {
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const id = pRepo.create({ slug: "py", title: "Py", statementMd: "", inputMd: "", outputMd: "", category: "x", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "", sampleTests: [], extraTests: [] });

    const rRepo = runRepo(db);
    rRepo.create({
      problemId: id,
      language: "py",
      codeSnapshot: "print('ok')",
      verdict: "AC",
      totalRuntimeMs: 12,
      perTest: [{ idx: 0, verdict: "AC", runtimeMs: 12, stderr: "" }],
    });

    expect(rRepo.listRecent(id, 5)[0]!.language).toBe("py");
  });
});

describe("aiMessageRepo", () => {
  test("creates messages and lists them in order", () => {
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const id = pRepo.create({
      slug: "A1-001", title: "x", statementMd: "", inputMd: "", outputMd: "",
      category: "A1", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "",
      sampleTests: [], extraTests: [],
    });

    const aRepo = aiMessageRepo(db);
    aRepo.create({ problemId: id, role: "user", content: "help me", provider: null, model: null, tokensIn: null, tokensOut: null });
    aRepo.create({ problemId: id, role: "assistant", content: "what have you tried?", provider: "ollama", model: "qwen2.5-coder:7b", tokensIn: 100, tokensOut: 30 });

    const msgs = aRepo.listForProblem(id);
    expect(msgs.length).toBe(2);
    expect(msgs[0]!.role).toBe("user");
    expect(msgs[0]!.content).toBe("help me");
    expect(msgs[1]!.role).toBe("assistant");
    expect(msgs[1]!.tokens_out).toBe(30);
  });

  test("updateContent edits a single message in place", () => {
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const id = pRepo.create({
      slug: "A1-003", title: "x", statementMd: "", inputMd: "", outputMd: "",
      category: "A1", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "",
      sampleTests: [], extraTests: [],
    });
    const aRepo = aiMessageRepo(db);
    const mid = aRepo.create({ problemId: id, role: "user", content: "what's the error?", provider: null, model: null, tokensIn: null, tokensOut: null });
    expect(aRepo.updateContent(mid, "what's the bug?")).toBe(true);
    const fetched = aRepo.getById(mid);
    expect(fetched!.content).toBe("what's the bug?");
  });

  test("deleteAfter drops every message later than the pivot in the same problem", () => {
    // The edit-and-resend flow relies on this: editing a mid-conversation user
    // message must invalidate every reply built on the old content, so we drop
    // them and let regenerate produce a fresh tail.
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const id = pRepo.create({
      slug: "A1-004", title: "x", statementMd: "", inputMd: "", outputMd: "",
      category: "A1", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "",
      sampleTests: [], extraTests: [],
    });
    const aRepo = aiMessageRepo(db);
    const u1 = aRepo.create({ problemId: id, role: "user", content: "first ask", provider: null, model: null, tokensIn: null, tokensOut: null });
    aRepo.create({ problemId: id, role: "assistant", content: "first reply", provider: "x", model: "y", tokensIn: 1, tokensOut: 1 });
    aRepo.create({ problemId: id, role: "user", content: "follow up", provider: null, model: null, tokensIn: null, tokensOut: null });
    aRepo.create({ problemId: id, role: "assistant", content: "second reply", provider: "x", model: "y", tokensIn: 1, tokensOut: 1 });

    const dropped = aRepo.deleteAfter(id, u1);
    expect(dropped).toBe(3);
    const remaining = aRepo.listForProblem(id);
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.id).toBe(u1);
    expect(remaining[0]!.content).toBe("first ask");
  });

  test("clearForProblem removes all messages and returns count", () => {
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const id = pRepo.create({
      slug: "A1-002", title: "x", statementMd: "", inputMd: "", outputMd: "",
      category: "A1", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "",
      sampleTests: [], extraTests: [],
    });
    const aRepo = aiMessageRepo(db);
    aRepo.create({ problemId: id, role: "user", content: "a", provider: null, model: null, tokensIn: null, tokensOut: null });
    aRepo.create({ problemId: id, role: "assistant", content: "b", provider: null, model: null, tokensIn: null, tokensOut: null });
    expect(aRepo.clearForProblem(id)).toBe(2);
    expect(aRepo.listForProblem(id).length).toBe(0);
  });
});
