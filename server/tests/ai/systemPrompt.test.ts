import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "../../src/ai/systemPrompt";

describe("buildSystemPrompt", () => {
  test("includes language, slug, title, statement excerpt, and code", () => {
    const prompt = buildSystemPrompt({
      language: "cpp",
      slug: "A1-001",
      title: "สวัสดี: ชื่อ",
      statementMd: "Read a name from input and print Hello, name.",
      code: "#include <iostream>\nint main(){}\n",
      verdict: null,
      runtimeMs: null,
      diff: null,
      stderr: null,
      forceFullSolution: false,
    });

    expect(prompt).toContain("cpp");
    expect(prompt).toContain("A1-001");
    expect(prompt).toContain("สวัสดี: ชื่อ");
    expect(prompt).toContain("Read a name from input");
    expect(prompt).toContain("#include <iostream>");
    expect(prompt).toContain("hint");
    expect(prompt).not.toContain("Forget the spoiler guard");
  });

  test("toggles spoiler override when forceFullSolution is true", () => {
    const prompt = buildSystemPrompt({
      language: "cpp", slug: "A1-001", title: "x", statementMd: "",
      code: "", verdict: null, runtimeMs: null, diff: null, stderr: null,
      forceFullSolution: true,
    });
    expect(prompt).toContain("show the complete solution");
  });

  test("includes verdict-specific context when a run result is present", () => {
    const wa = buildSystemPrompt({
      language: "cpp", slug: "A1-001", title: "x", statementMd: "",
      code: "int main(){}", verdict: "WA", runtimeMs: 42,
      diff: "- 3\n+ 4", stderr: null, forceFullSolution: false,
    });
    expect(wa).toContain("WA");
    expect(wa).toContain("- 3");

    const re = buildSystemPrompt({
      language: "cpp", slug: "A1-001", title: "x", statementMd: "",
      code: "int main(){}", verdict: "RE", runtimeMs: 12,
      diff: null, stderr: "Segmentation fault", forceFullSolution: false,
    });
    expect(re).toContain("RE");
    expect(re).toContain("Segmentation fault");
  });

  test("injects userProfile and tutorStyle verbatim when provided", () => {
    const prompt = buildSystemPrompt({
      language: "cpp", slug: "A1-001", title: "x", statementMd: "",
      code: "", verdict: null, runtimeMs: null, diff: null, stderr: null,
      forceFullSolution: false,
      userProfile: "M.5 student, weak on graphs, comfortable with arrays.",
      tutorStyle: "Be terse. Ask one Socratic question. Mix Thai + English.",
    });
    expect(prompt).toContain("About the student");
    expect(prompt).toContain("M.5 student, weak on graphs");
    expect(prompt).toContain("Style preferences");
    expect(prompt).toContain("Ask one Socratic question");
  });

  test("omits personalization sections when fields are empty or whitespace-only", () => {
    const prompt = buildSystemPrompt({
      language: "cpp", slug: "A1-001", title: "x", statementMd: "",
      code: "", verdict: null, runtimeMs: null, diff: null, stderr: null,
      forceFullSolution: false,
      userProfile: "   ",
      tutorStyle: "",
    });
    expect(prompt).not.toContain("About the student");
    expect(prompt).not.toContain("Style preferences");
  });

  test("pins the reply language when responseLanguage is set, else mirrors the question", () => {
    const base = {
      language: "cpp" as const, slug: "A1-001", title: "x", statementMd: "",
      code: "", verdict: null, runtimeMs: null, diff: null, stderr: null, forceFullSolution: false,
    };
    expect(buildSystemPrompt({ ...base, responseLanguage: "th" })).toContain("Always reply in Thai");
    expect(buildSystemPrompt({ ...base, responseLanguage: "en" })).toContain("Always reply in English");
    expect(buildSystemPrompt({ ...base, responseLanguage: "auto" })).toContain("student's question's language");
    // Omitted = auto behaviour (back-compat).
    expect(buildSystemPrompt(base)).toContain("student's question's language");
  });

  test("truncates statement excerpts longer than 2KB", () => {
    const long = "x".repeat(5000);
    const prompt = buildSystemPrompt({
      language: "cpp", slug: "A1-001", title: "x", statementMd: long,
      code: "", verdict: null, runtimeMs: null, diff: null, stderr: null,
      forceFullSolution: false,
    });
    const xCount = (prompt.match(/x/g) ?? []).length;
    expect(xCount).toBeLessThanOrEqual(2048 + 10);
  });
});
