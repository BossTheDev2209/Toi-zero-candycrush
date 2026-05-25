import { describe, expect, test } from "bun:test";
import { openDb } from "../../src/db/client";
import { problemRepo } from "../../src/db/repo/problems";
import { solutionRepo } from "../../src/db/repo/solutions";
import { runRepo } from "../../src/db/repo/runs";

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
});

describe("solutionRepo", () => {
  test("upserts solution per problem", () => {
    const db = openDb(":memory:");
    const pRepo = problemRepo(db);
    const id = pRepo.create({ slug: "a", title: "A", statementMd: "", inputMd: "", outputMd: "", category: "x", timeLimitMs: 1000, memoryLimitMb: 256, ioMode: "stdio", sourceUrl: "", sampleTests: [], extraTests: [] });

    const sRepo = solutionRepo(db);
    sRepo.upsert(id, "cpp", "int main(){}");
    expect(sRepo.get(id)?.code).toBe("int main(){}");
    sRepo.upsert(id, "cpp", "int main(){return 0;}");
    expect(sRepo.get(id)?.code).toBe("int main(){return 0;}");
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
});
