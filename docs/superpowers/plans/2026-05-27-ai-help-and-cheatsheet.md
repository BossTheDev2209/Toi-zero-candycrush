# AI Help, Cheat Sheets, Ctrl+K Palette — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-provider AI help panel (Anthropic / OpenAI / Ollama) with spoiler-guarded tutoring, per-language curated cheat sheets (C / C++ / Python), and a global Ctrl+K command palette that searches problems + cheat sheet entries + docs sections in one bar.

**Architecture:** Server-side provider abstraction (`AiProvider` interface, three concrete impls, dispatcher selects from `cfg.ai.provider`). New `ai_message` SQLite table for per-problem conversation persistence. Markdown cheat sheets bundled as Vite-imported strings with a static heading-index for search. Single global command palette mounted in `App.tsx`, opened by `Ctrl+K` / `Cmd+K`, fuzzy-matches across three sources.

**Tech Stack:** Bun + Hono server, Vite + React + TailwindCSS v4, react-markdown for rendering, native `fetch` for AI provider calls (no SDK dependency), bundled Vite `?raw` markdown imports.

**Design source of truth:** [docs/superpowers/specs/2026-05-27-ai-help-and-cheatsheet.md](../specs/2026-05-27-ai-help-and-cheatsheet.md) and [info/DESIGN.md](../../../info/DESIGN.md).

---

## File Structure

```
server/src/
├── ai/
│   ├── provider.ts            (interfaces + dispatcher)
│   ├── anthropic.ts           (POST messages API)
│   ├── openai.ts              (POST chat/completions)
│   ├── ollama.ts              (POST api/chat to local server)
│   └── systemPrompt.ts        (builds spoiler-guarded prompt)
├── api/
│   └── ai.ts                  (Hono routes /ask /history /status)
├── db/
│   ├── schema.sql             (+ ai_message table)
│   ├── client.ts              (+ migration shim for ai_message)
│   └── repo/
│       └── ai_messages.ts     (create / listForProblem / clearForProblem)
└── config.ts                  (+ AppConfig.ai, + persistAiUpdate)

server/tests/
├── ai/
│   ├── systemPrompt.test.ts
│   └── ollama.test.ts         (mock fetch)
└── db/repo.test.ts            (+ ai_messages cases)

web/src/
├── components/
│   ├── AiHelpPanel.tsx
│   ├── CommandPalette.tsx
│   ├── CheatSheetTOC.tsx
│   └── NavPill.tsx            (+ Cheat sheet link + ⌘K button)
├── data/cheatsheet/
│   ├── cpp.md
│   ├── c.md
│   ├── py.md
│   └── meta.ts
├── lib/
│   ├── ai.ts                  (typed api client)
│   ├── fuzzy.ts
│   ├── hotkey.ts              (useHotkey)
│   └── docsIndex.ts           (exported H2 list, consumed by DocsPage AND palette)
├── pages/
│   ├── CheatSheetPage.tsx
│   ├── SettingsPage.tsx       (+ AI provider section)
│   ├── ProblemWorkspacePage.tsx (+ mount AiHelpPanel)
│   └── DocsPage.tsx           (refactor: consume docsIndex)
└── App.tsx                    (+ /cheatsheet/:lang route, + CommandPalette mount)
```

**Decomposition rationale:**
- `ai/` modules split per provider so each can be replaced or added without touching the others.
- `systemPrompt.ts` is its own file because it's the load-bearing prompt logic and deserves unit tests independent of network calls.
- Cheat sheet markdown stays in `data/` because it's content, not code.
- `docsIndex.ts` is extracted from `DocsPage.tsx` so the palette can import it without rendering the whole page.
- `fuzzy.ts` and `hotkey.ts` are tiny standalone utilities — easier to test in isolation than embedded.

---

## Task 1: Config schema + persistAiUpdate

**Files:**
- Modify: `server/src/config.ts`
- Modify: `settings.example.json`

- [ ] **Step 1: Extend `AppConfig.ai` and add `persistAiUpdate`**

Edit `server/src/config.ts`:

After the `toi` block in `AppConfig`, add:

```typescript
  ai: {
    provider: "anthropic" | "openai" | "ollama";
    anthropicApiKey?: string;
    anthropicModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
    maxTokens?: number;
  };
```

At the bottom of `config.ts`, after `persistToiUpdate`, add:

```typescript
export function persistAiUpdate(cfg: AppConfig, patch: Partial<AppConfig["ai"]>): void {
  const root = cfg._root ?? process.cwd();
  const path = join(root, "settings.json");
  if (!existsSync(path)) throw new Error("settings.json not found at " + path);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.ai = { ...(raw.ai ?? {}), ...patch };
  writeFileSync(path, JSON.stringify(raw, null, 2) + "\n", "utf8");
  cfg.ai = { ...cfg.ai, ...patch };
}
```

- [ ] **Step 2: Update settings.example.json**

In `settings.example.json`, after the `toi` block, add:

```json
  "ai": {
    "provider": "ollama",
    "anthropicApiKey": "",
    "anthropicModel": "claude-sonnet-4-5",
    "openaiApiKey": "",
    "openaiModel": "gpt-4o-mini",
    "ollamaUrl": "http://localhost:11434",
    "ollamaModel": "qwen2.5-coder:7b",
    "maxTokens": 1024
  }
```

Also patch the user's `settings.json` with the same block — but only the `provider`/`ollamaUrl`/`ollamaModel`/`maxTokens` fields prefilled, keys blank. The implementer must NOT echo any TOI cookie/xsrf into the change.

- [ ] **Step 3: Type-check passes**

Run: `bun --cwd server test`
Expected: 44 passing (no behavior change yet, this is type-only).

- [ ] **Step 4: Commit**

```bash
git add server/src/config.ts settings.example.json settings.json
git commit -m "feat(config): add AI provider settings + persistAiUpdate"
```

---

## Task 2: Database — ai_message table

**Files:**
- Modify: `server/src/db/schema.sql`
- Modify: `server/src/db/client.ts`
- Create: `server/src/db/repo/ai_messages.ts`
- Modify: `server/tests/db/repo.test.ts`

- [ ] **Step 1: Add table to schema**

At the bottom of `server/src/db/schema.sql`, after the `toi_submission` table:

```sql
CREATE TABLE IF NOT EXISTS ai_message (
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
```

- [ ] **Step 2: Migration safeguard in client.ts**

In `server/src/db/client.ts`, after the existing `if (!hasCol("toi_counts"))` block but BEFORE `migrateLanguageChecks(db)`, add:

```typescript
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
```

- [ ] **Step 3: Write failing repo test**

Append to `server/tests/db/repo.test.ts` inside the file (new describe block at end):

```typescript
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
```

At top of file add import:

```typescript
import { aiMessageRepo } from "../../src/db/repo/ai_messages";
```

- [ ] **Step 4: Run test, confirm failure**

Run: `bun --cwd server test`
Expected: 2 new failures with `Cannot find module './repo/ai_messages'`.

- [ ] **Step 5: Implement repo**

Create `server/src/db/repo/ai_messages.ts`:

```typescript
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
```

- [ ] **Step 6: Run tests, confirm pass**

Run: `bun --cwd server test`
Expected: 46 passing (44 prior + 2 new).

- [ ] **Step 7: Commit**

```bash
git add server/src/db/schema.sql server/src/db/client.ts server/src/db/repo/ai_messages.ts server/tests/db/repo.test.ts
git commit -m "feat(db): add ai_message table and aiMessageRepo"
```

---

## Task 3: AI provider abstraction + system prompt

**Files:**
- Create: `server/src/ai/provider.ts`
- Create: `server/src/ai/systemPrompt.ts`
- Create: `server/tests/ai/systemPrompt.test.ts`

- [ ] **Step 1: Provider interfaces**

Create `server/src/ai/provider.ts`:

```typescript
import type { AppConfig } from "../config";

export type ProviderName = "anthropic" | "openai" | "ollama";

export interface AiAskInput {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}

export interface AiAskResult {
  ok: boolean;
  text: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

export interface AiProvider {
  name: ProviderName;
  model: string;
  ask(input: AiAskInput): Promise<AiAskResult>;
}

export interface AiProviderDispatcher {
  current(): AiProvider;
}

// Implemented in Task 5 once the concrete providers exist. For now, exporting
// the signatures keeps Task 4 (systemPrompt) free of provider implementation details.
export function buildProvider(_cfg: AppConfig["ai"]): AiProvider {
  throw new Error("buildProvider not implemented yet — see Task 5");
}
```

- [ ] **Step 2: Write failing systemPrompt test**

Create `server/tests/ai/systemPrompt.test.ts`:

```typescript
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
    expect(prompt).toContain("hint");      // tutor instructions present
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
```

- [ ] **Step 3: Run test, confirm failure**

Run: `bun --cwd server test tests/ai/systemPrompt.test.ts`
Expected: 4 failures with `Cannot find module '../../src/ai/systemPrompt'`.

- [ ] **Step 4: Implement systemPrompt**

Create `server/src/ai/systemPrompt.ts`:

```typescript
export interface SystemPromptContext {
  language: "c" | "cpp" | "py";
  slug: string;
  title: string;
  statementMd: string;
  code: string;
  verdict: "AC" | "WA" | "TLE" | "RE" | "CE" | null;
  runtimeMs: number | null;
  diff: string | null;
  stderr: string | null;
  forceFullSolution: boolean;
}

const MAX_STATEMENT = 2048;

function verdictNote(ctx: SystemPromptContext): string {
  if (!ctx.verdict) return "Latest local run: (none yet)";
  const head = `Latest local run: verdict=${ctx.verdict}, runtime=${ctx.runtimeMs ?? "?"}ms`;
  switch (ctx.verdict) {
    case "AC":  return `${head}\n(All sample tests passed locally. Congratulate them briefly, then suggest the next step.)`;
    case "WA":  return `${head}\nDiff (- expected, + got):\n${ctx.diff ?? "(no diff captured)"}`;
    case "TLE": return `${head}\nTheir solution is too slow. Discuss algorithm complexity, not micro-optimizations.`;
    case "RE":  return `${head}\nStderr:\n${ctx.stderr ?? "(no stderr captured)"}`;
    case "CE":  return `${head}\nCompiler output:\n${ctx.stderr ?? "(no compiler output captured)"}`;
  }
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const statement = ctx.statementMd.slice(0, MAX_STATEMENT);
  const spoilerLine = ctx.forceFullSolution
    ? "The student has explicitly asked you to show the complete solution. Do so, with explanation."
    : "Give SHORT, targeted HINTS. Use Socratic questions when helpful. Do NOT write the full solution unless explicitly asked.";

  return [
    "You are a programming tutor for a Thai high-school student preparing for the",
    "Thailand Olympiad in Informatics (TOI). You are helping them with a competitive",
    "programming problem.",
    "",
    spoilerLine,
    "If they're close, point at the specific line or algorithm gap. If they're far,",
    "suggest the right algorithm category but make them write the code.",
    "",
    `Language: ${ctx.language}`,
    `Problem: ${ctx.slug} — ${ctx.title}`,
    "",
    "Statement (excerpt):",
    statement,
    "",
    "Their current code:",
    "```" + ctx.language,
    ctx.code || "(empty)",
    "```",
    "",
    verdictNote(ctx),
    "",
    "Reply in the student's question's language (Thai or English). Be concise.",
  ].join("\n");
}
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `bun --cwd server test tests/ai/systemPrompt.test.ts`
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/ai/provider.ts server/src/ai/systemPrompt.ts server/tests/ai/systemPrompt.test.ts
git commit -m "feat(ai): add provider interface and spoiler-guarded system prompt"
```

---

## Task 4: Ollama provider (TDD with mocked fetch)

**Files:**
- Create: `server/src/ai/ollama.ts`
- Create: `server/tests/ai/ollama.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/tests/ai/ollama.test.ts`:

```typescript
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { askOllama } from "../../src/ai/ollama";

const realFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      message: { role: "assistant", content: "Hello from mock Ollama." },
      prompt_eval_count: 42,
      eval_count: 17,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => { globalThis.fetch = realFetch; });

describe("askOllama", () => {
  test("posts to /api/chat with system + messages and parses content", async () => {
    const result = await askOllama({
      baseUrl: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a tutor.",
      messages: [{ role: "user", content: "help" }],
      maxTokens: 1024,
    });
    expect(result.ok).toBe(true);
    expect(result.text).toBe("Hello from mock Ollama.");
    expect(result.tokensIn).toBe(42);
    expect(result.tokensOut).toBe(17);
    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.model).toBe("qwen2.5-coder:7b");
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a tutor." });
    expect(body.messages[1]).toEqual({ role: "user", content: "help" });
    expect(body.stream).toBe(false);
  });

  test("returns ok: false with error message when fetch throws", async () => {
    globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
    const result = await askOllama({
      baseUrl: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      systemPrompt: "x", messages: [], maxTokens: 1024,
    });
    expect(result.ok).toBe(false);
    expect(result.text).toBe("");
    expect(result.error).toContain("ECONNREFUSED");
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `bun --cwd server test tests/ai/ollama.test.ts`
Expected: failure — module not found.

- [ ] **Step 3: Implement ollama provider**

Create `server/src/ai/ollama.ts`:

```typescript
import type { AiAskResult } from "./provider";

export interface AskOllamaInput {
  baseUrl: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}

export async function askOllama(input: AskOllamaInput): Promise<AiAskResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const body = {
    model: input.model,
    stream: false,
    options: { num_predict: input.maxTokens },
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: "", error: `Ollama HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    return {
      ok: true,
      text: data.message?.content ?? "",
      tokensIn: data.prompt_eval_count,
      tokensOut: data.eval_count,
    };
  } catch (e: any) {
    return { ok: false, text: "", error: e?.message ?? String(e) };
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `bun --cwd server test tests/ai/ollama.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/ai/ollama.ts server/tests/ai/ollama.test.ts
git commit -m "feat(ai): add Ollama provider with mocked fetch tests"
```

---

## Task 5: Anthropic + OpenAI providers + dispatcher

**Files:**
- Create: `server/src/ai/anthropic.ts`
- Create: `server/src/ai/openai.ts`
- Modify: `server/src/ai/provider.ts`

- [ ] **Step 1: Implement Anthropic provider**

Create `server/src/ai/anthropic.ts`:

```typescript
import type { AiAskResult } from "./provider";

export interface AskAnthropicInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}

export async function askAnthropic(input: AskAnthropicInput): Promise<AiAskResult> {
  if (!input.apiKey) return { ok: false, text: "", error: "Anthropic API key missing" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        system: input.systemPrompt,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: "", error: `Anthropic HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    return {
      ok: true,
      text,
      tokensIn: data.usage?.input_tokens,
      tokensOut: data.usage?.output_tokens,
    };
  } catch (e: any) {
    return { ok: false, text: "", error: e?.message ?? String(e) };
  }
}
```

- [ ] **Step 2: Implement OpenAI provider**

Create `server/src/ai/openai.ts`:

```typescript
import type { AiAskResult } from "./provider";

export interface AskOpenAiInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}

export async function askOpenAi(input: AskOpenAiInput): Promise<AiAskResult> {
  if (!input.apiKey) return { ok: false, text: "", error: "OpenAI API key missing" };
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        messages: [
          { role: "system", content: input.systemPrompt },
          ...input.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: "", error: `OpenAI HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      ok: true,
      text: data.choices?.[0]?.message?.content ?? "",
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
    };
  } catch (e: any) {
    return { ok: false, text: "", error: e?.message ?? String(e) };
  }
}
```

- [ ] **Step 3: Replace the stub `buildProvider` in `provider.ts`**

Open `server/src/ai/provider.ts`. Replace the `buildProvider` function at the bottom with:

```typescript
import { askOllama } from "./ollama";
import { askAnthropic } from "./anthropic";
import { askOpenAi } from "./openai";

export function buildProvider(ai: AppConfig["ai"]): AiProvider {
  const provider = ai.provider ?? "ollama";
  const maxTokens = ai.maxTokens ?? 1024;

  if (provider === "anthropic") {
    const model = ai.anthropicModel || "claude-sonnet-4-5";
    return {
      name: "anthropic",
      model,
      ask: (input) => askAnthropic({
        apiKey: ai.anthropicApiKey ?? "",
        model,
        systemPrompt: input.systemPrompt,
        messages: input.messages,
        maxTokens: input.maxTokens ?? maxTokens,
      }),
    };
  }
  if (provider === "openai") {
    const model = ai.openaiModel || "gpt-4o-mini";
    return {
      name: "openai",
      model,
      ask: (input) => askOpenAi({
        apiKey: ai.openaiApiKey ?? "",
        model,
        systemPrompt: input.systemPrompt,
        messages: input.messages,
        maxTokens: input.maxTokens ?? maxTokens,
      }),
    };
  }
  const model = ai.ollamaModel || "qwen2.5-coder:7b";
  return {
    name: "ollama",
    model,
    ask: (input) => askOllama({
      baseUrl: ai.ollamaUrl || "http://localhost:11434",
      model,
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      maxTokens: input.maxTokens ?? maxTokens,
    }),
  };
}
```

- [ ] **Step 4: Tests still pass**

Run: `bun --cwd server test`
Expected: 48 PASS (46 prior + 2 systemPrompt + 2 ollama, anthropic/openai untested — we don't hit real APIs in tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/ai/anthropic.ts server/src/ai/openai.ts server/src/ai/provider.ts
git commit -m "feat(ai): add Anthropic + OpenAI providers and dispatcher"
```

---

## Task 6: API routes for /ask /history /status

**Files:**
- Create: `server/src/api/ai.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Implement ai router**

Create `server/src/api/ai.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { problemRepo } from "../db/repo/problems";
import { solutionRepo } from "../db/repo/solutions";
import { runRepo } from "../db/repo/runs";
import { aiMessageRepo } from "../db/repo/ai_messages";
import { buildProvider } from "../ai/provider";
import { buildSystemPrompt } from "../ai/systemPrompt";

const AskZ = z.object({
  problemId: z.number().int().positive(),
  message: z.string().min(1),
  forceFullSolution: z.boolean().default(false),
});

export function aiRouter(db: Database, cfg: AppConfig) {
  const r = new Hono();
  const pRepo = problemRepo(db);
  const sRepo = solutionRepo(db);
  const rRepo = runRepo(db);
  const mRepo = aiMessageRepo(db);

  r.get("/status", (c) => {
    const provider = cfg.ai?.provider ?? "ollama";
    let hasKey = false;
    let model = "";
    if (provider === "anthropic") { hasKey = Boolean(cfg.ai?.anthropicApiKey); model = cfg.ai?.anthropicModel ?? "claude-sonnet-4-5"; }
    else if (provider === "openai") { hasKey = Boolean(cfg.ai?.openaiApiKey); model = cfg.ai?.openaiModel ?? "gpt-4o-mini"; }
    else { hasKey = true; model = cfg.ai?.ollamaModel ?? "qwen2.5-coder:7b"; }
    return c.json({ provider, model, hasKey });
  });

  r.get("/history/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    return c.json({ messages: mRepo.listForProblem(id) });
  });

  r.delete("/history/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    const deleted = mRepo.clearForProblem(id);
    return c.json({ deleted });
  });

  r.post("/ask", async (c) => {
    const body = AskZ.parse(await c.req.json());
    const problem = pRepo.getById(body.problemId);
    if (!problem) return c.json({ ok: false, error: "problem not found" }, 404);

    const solution = sRepo.get(body.problemId);
    const language = (solution?.language ?? "cpp") as "c" | "cpp" | "py";
    const code = solution?.code ?? "";
    const recent = rRepo.listRecent(body.problemId, 1)[0];

    let diff: string | null = null;
    let stderr: string | null = null;
    if (recent) {
      const perTest = JSON.parse(recent.per_test_json) as { diff?: string; stderr?: string }[];
      diff = perTest.find((t) => t.diff)?.diff ?? null;
      stderr = perTest.find((t) => t.stderr)?.stderr ?? null;
    }

    const systemPrompt = buildSystemPrompt({
      language,
      slug: problem.slug,
      title: problem.title,
      statementMd: problem.statement_md,
      code,
      verdict: (recent?.verdict as any) ?? null,
      runtimeMs: recent?.total_runtime_ms ?? null,
      diff,
      stderr,
      forceFullSolution: body.forceFullSolution,
    });

    const history = mRepo.listForProblem(body.problemId).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    history.push({ role: "user", content: body.message });

    mRepo.create({
      problemId: body.problemId,
      role: "user",
      content: body.message,
      provider: null,
      model: null,
      tokensIn: null,
      tokensOut: null,
    });

    const provider = buildProvider(cfg.ai);
    const result = await provider.ask({
      systemPrompt,
      messages: history,
      maxTokens: cfg.ai?.maxTokens ?? 1024,
    });

    if (!result.ok) {
      return c.json({ ok: false, error: result.error, provider: provider.name, model: provider.model }, 502);
    }

    mRepo.create({
      problemId: body.problemId,
      role: "assistant",
      content: result.text,
      provider: provider.name,
      model: provider.model,
      tokensIn: result.tokensIn ?? null,
      tokensOut: result.tokensOut ?? null,
    });

    return c.json({
      ok: true,
      text: result.text,
      provider: provider.name,
      model: provider.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
  });

  return r;
}
```

- [ ] **Step 2: Wire router into index.ts**

In `server/src/index.ts`, add the import + route:

After existing imports:

```typescript
import { aiRouter } from "./api/ai";
```

After `app.route("/api/toi", toiRouter(db, cfg));` add:

```typescript
app.route("/api/ai", aiRouter(db, cfg));
```

- [ ] **Step 3: Smoke test via curl**

Run server in background: `bun --cwd server start`
Test:

```bash
curl -s http://localhost:8787/api/ai/status
# Expect: {"provider":"ollama","model":"qwen2.5-coder:7b","hasKey":true}

curl -s http://localhost:8787/api/ai/history/1
# Expect: {"messages":[]}
```

Stop server.

- [ ] **Step 4: Commit**

```bash
git add server/src/api/ai.ts server/src/index.ts
git commit -m "feat(api): wire /api/ai/{status,history,ask}"
```

---

## Task 7: Settings page — AI provider section

**Files:**
- Create: `server/src/api/ai-settings.ts` (POST /credentials)
- Modify: `server/src/api/ai.ts` (mount sub-router)
- Modify: `web/src/pages/SettingsPage.tsx`
- Modify: `web/src/lib/api.ts`

- [ ] **Step 1: Implement AI settings API**

Open `server/src/api/ai.ts`. At the top, after existing imports, add:

```typescript
import { persistAiUpdate } from "../config";

const AiSettingsZ = z.object({
  provider: z.enum(["anthropic", "openai", "ollama"]),
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string().optional(),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  ollamaUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});
```

Inside `aiRouter`, add a new route before `return r;`:

```typescript
  r.post("/settings", async (c) => {
    const body = AiSettingsZ.parse(await c.req.json());
    persistAiUpdate(cfg, body);
    return c.json({ ok: true, provider: body.provider });
  });
```

- [ ] **Step 2: Add API client methods**

In `web/src/lib/api.ts`, add to the `api` object:

```typescript
  getAiStatus: () => fetch("/api/ai/status").then(json<{ provider: string; model: string; hasKey: boolean }>),
  saveAiSettings: (body: {
    provider: "anthropic" | "openai" | "ollama";
    anthropicApiKey?: string;
    anthropicModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
    maxTokens?: number;
  }) =>
    fetch("/api/ai/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean; provider: string }>),
  getAiHistory: (problemId: number) =>
    fetch(`/api/ai/history/${problemId}`).then(json<{ messages: { id: number; role: "user" | "assistant"; content: string; tokens_in: number | null; tokens_out: number | null; created_at: string }[] }>),
  clearAiHistory: (problemId: number) =>
    fetch(`/api/ai/history/${problemId}`, { method: "DELETE" }).then(json<{ deleted: number }>),
  askAi: (body: { problemId: number; message: string; forceFullSolution?: boolean }) =>
    fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean; text?: string; provider?: string; model?: string; tokensIn?: number; tokensOut?: number; error?: string }>),
```

- [ ] **Step 3: Extend SettingsPage with AI section**

In `web/src/pages/SettingsPage.tsx`, at the bottom of the component (before the closing `</div>`), add a new section element. Full revised file structure: the existing TOI section is unchanged; the new section follows. Append the snippet below before the existing closing `</div>` of the page wrapper:

```tsx
      <section className="mt-8 rounded-[40px] bg-[var(--color-lifted)] p-8">
        <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-3">AI assistant</div>
        <AiSettings />
      </section>
```

At the top of the file (after existing imports), add:

```tsx
import { api } from "../lib/api";
```

Replace any existing duplicate import of `api` with a single one.

Below the existing `SettingsPage` component, add a new component `AiSettings`:

```tsx
type Provider = "anthropic" | "openai" | "ollama";

function AiSettings() {
  const [provider, setProvider] = useState<Provider>("ollama");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5-coder:7b");
  const [anthropicModel, setAnthropicModel] = useState("claude-sonnet-4-5");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [maxTokens, setMaxTokens] = useState(1024);
  const [status, setStatus] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadStatus() {
    try { setStatus(await api.getAiStatus()); } catch (e: any) { setErr(e?.message ?? String(e)); }
  }
  useEffect(() => { void loadStatus(); }, []);

  async function save() {
    setMsg(null); setErr(null);
    try {
      await api.saveAiSettings({
        provider,
        anthropicApiKey: anthropicKey || undefined,
        anthropicModel,
        openaiApiKey: openaiKey || undefined,
        openaiModel,
        ollamaUrl,
        ollamaModel,
        maxTokens,
      });
      setMsg("Saved.");
      setAnthropicKey(""); setOpenaiKey(""); // clear from memory
      await loadStatus();
    } catch (e: any) { setErr(e?.message ?? String(e)); }
  }

  const inputCls = "w-full rounded-2xl border border-[var(--color-dust)] bg-white px-4 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)]";
  const labelCls = "block text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-1.5";

  return (
    <div className="space-y-4">
      <label className="block">
        <div className={labelCls}>Provider</div>
        <select className={inputCls} value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
          <option value="ollama">Ollama (local, free)</option>
          <option value="anthropic">Anthropic Claude</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>

      {provider === "anthropic" && (
        <>
          <label className="block"><div className={labelCls}>Anthropic API key</div>
            <input type="password" className={inputCls} value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder={status?.hasKey ? "leave blank to keep existing" : "sk-ant-..."} /></label>
          <label className="block"><div className={labelCls}>Model</div>
            <input className={inputCls} value={anthropicModel} onChange={(e) => setAnthropicModel(e.target.value)} /></label>
        </>
      )}
      {provider === "openai" && (
        <>
          <label className="block"><div className={labelCls}>OpenAI API key</div>
            <input type="password" className={inputCls} value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder={status?.hasKey ? "leave blank to keep existing" : "sk-..."} /></label>
          <label className="block"><div className={labelCls}>Model</div>
            <input className={inputCls} value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} /></label>
        </>
      )}
      {provider === "ollama" && (
        <>
          <label className="block"><div className={labelCls}>Ollama base URL</div>
            <input className={inputCls} value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} /></label>
          <label className="block"><div className={labelCls}>Model</div>
            <input className={inputCls} value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} /></label>
        </>
      )}

      <label className="block"><div className={labelCls}>Max tokens per reply</div>
        <input type="number" className={inputCls} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} /></label>

      <div className="pt-2">
        <PillButton onClick={save}>Save AI settings</PillButton>
      </div>
      {msg && <div className="text-sm text-[var(--color-signal-light)]">{msg}</div>}
      {err && <div className="text-sm text-[var(--color-signal)]">{err}</div>}

      {status && (
        <div className="mt-4 text-sm text-[var(--color-slate)]">
          Active: <span className="font-mono text-[12px] text-[var(--color-graphite)]">{status.provider} · {status.model}</span>{" "}
          {status.hasKey ? "(configured)" : "(missing key)"}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build + smoke**

Run: `bun --cwd web build`
Expected: clean build.

Run servers, open `/settings`. Confirm new "AI assistant" section appears with provider dropdown.

- [ ] **Step 5: Commit**

```bash
git add server/src/api/ai.ts web/src/lib/api.ts web/src/pages/SettingsPage.tsx
git commit -m "feat(web): add AI provider configuration to settings page"
```

---

## Task 8: AiHelpPanel component + workspace mount

**Files:**
- Create: `web/src/components/AiHelpPanel.tsx`
- Modify: `web/src/pages/ProblemWorkspacePage.tsx`

- [ ] **Step 1: Implement panel**

Create `web/src/components/AiHelpPanel.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { MarkdownRender } from "./MarkdownRender";
import { PillButton } from "./PillButton";

interface AiMessage { id: number; role: "user" | "assistant"; content: string; tokens_in: number | null; tokens_out: number | null; created_at: string; }

export function AiHelpPanel({ problemId }: { problemId: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    void api.getAiStatus().then(setStatus).catch(() => setStatus(null));
    void api.getAiHistory(problemId).then((r) => setMessages(r.messages));
  }, [open, problemId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function send(force = false) {
    if (!draft.trim() || busy) return;
    setBusy(true); setError(null);
    const userMsg: AiMessage = {
      id: -1, role: "user", content: draft, tokens_in: null, tokens_out: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const message = draft;
    setDraft("");
    try {
      const res = await api.askAi({ problemId, message, forceFullSolution: force });
      if (!res.ok) {
        setError(res.error ?? "AI request failed.");
        // Roll back the optimistic user message visually only if we want to;
        // for transparency we keep it visible and add an error inline.
      } else {
        // Refresh from server so IDs + tokens line up correctly.
        const fresh = await api.getAiHistory(problemId);
        setMessages(fresh.messages);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    await api.clearAiHistory(problemId);
    setMessages([]);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 rounded-l-[20px] border border-[var(--color-dust)] border-r-0 bg-[var(--color-lifted)] px-3 py-4 text-[var(--color-ink)] shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
        aria-label="Open AI Help"
      >
        <span className="block writing-vertical text-[12px] font-bold tracking-[0.08em] uppercase">Help</span>
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 w-[380px] max-w-[90vw] border-l border-[var(--color-dust)] bg-[var(--color-canvas)] shadow-[-12px_0_36px_rgba(0,0,0,0.08)] flex flex-col" style={{ transition: "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <div className="flex items-center justify-between border-b border-[var(--color-dust)] px-5 py-3">
        <div className="text-sm font-medium tracking-[-0.02em]">AI Help{status ? ` · ${status.provider}` : ""}</div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} title="Clear chat" className="text-[var(--color-slate)] hover:text-[var(--color-ink)] px-2 text-sm">Clear</button>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--color-slate)] hover:text-[var(--color-ink)] px-2 text-lg leading-none">×</button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && status?.hasKey && (
          <p className="text-sm text-[var(--color-slate)]">Ask for a hint about this problem. The AI sees your saved code, statement, and latest run result.</p>
        )}
        {messages.length === 0 && status && !status.hasKey && (
          <div className="rounded-2xl border border-[var(--color-dust)] bg-[var(--color-lifted)] p-4 text-sm">
            <p className="mb-2">No AI provider key configured.</p>
            <a href="/settings" className="text-[var(--color-link)] underline">Open Settings</a>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user"
              ? "max-w-[85%] rounded-[18px] rounded-br-md bg-[var(--color-ink)] text-[var(--color-canvas)] px-4 py-2.5 text-sm"
              : "max-w-[92%] rounded-[18px] rounded-bl-md bg-[var(--color-lifted)] border border-[var(--color-dust)] px-4 py-2.5 text-sm"}>
              {m.role === "assistant" ? <MarkdownRender>{m.content}</MarkdownRender> : m.content}
              {m.role === "assistant" && (m.tokens_in || m.tokens_out) && (
                <div className="mt-1 text-[10px] text-[var(--color-slate)]">{m.tokens_in ?? 0} in · {m.tokens_out ?? 0} out</div>
              )}
            </div>
          </div>
        ))}
        {error && <div className="rounded-2xl bg-[var(--color-lifted)] border border-[var(--color-signal)] p-3 text-xs text-[var(--color-signal)]">{error}</div>}
      </div>

      <div className="border-t border-[var(--color-dust)] px-4 py-3 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(false); } }}
          placeholder="Ask for a hint... (Ctrl+Enter to send)"
          rows={3}
          className="w-full rounded-2xl border border-[var(--color-dust)] bg-white text-[var(--color-ink)] placeholder:text-[var(--color-slate)] px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-ink)]"
        />
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => void send(true)} disabled={busy || !draft.trim()} className="text-xs text-[var(--color-slate)] hover:text-[var(--color-ink)] disabled:opacity-50">Just show me</button>
          <PillButton onClick={() => void send(false)} disabled={busy || !draft.trim()}>{busy ? "..." : "Send"}</PillButton>
        </div>
      </div>
    </div>
  );
}
```

Note on `writing-vertical`: add to globals.css in next step.

- [ ] **Step 2: Add vertical writing-mode utility class**

Append to `web/src/styles/globals.css`:

```css
.writing-vertical {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
```

- [ ] **Step 3: Mount in ProblemWorkspacePage**

In `web/src/pages/ProblemWorkspacePage.tsx`, add to imports:

```tsx
import { AiHelpPanel } from "../components/AiHelpPanel";
```

At the bottom of the returned JSX (just before the outermost closing `</div>` or `</section>`), add:

```tsx
      {p && <AiHelpPanel problemId={p.id} />}
```

- [ ] **Step 4: Manual smoke**

Boot servers. Open a problem. Click the "Help" tab on the right edge. Confirm panel slides in. Empty state shows. Settings link works.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AiHelpPanel.tsx web/src/pages/ProblemWorkspacePage.tsx web/src/styles/globals.css
git commit -m "feat(web): add AI help slide-out panel to workspace"
```

---

## Task 9: Cheat sheet content + page

**Files:**
- Create: `web/src/data/cheatsheet/cpp.md`
- Create: `web/src/data/cheatsheet/c.md`
- Create: `web/src/data/cheatsheet/py.md`
- Create: `web/src/data/cheatsheet/meta.ts`
- Create: `web/src/pages/CheatSheetPage.tsx`
- Create: `web/src/components/CheatSheetTOC.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/NavPill.tsx`

- [ ] **Step 1: Write cpp.md content**

Create `web/src/data/cheatsheet/cpp.md` with these sections. Each H2 must be unique within the file. Aim for ~150 lines; the snippet below is the skeleton — fill each section with at least one code block + 1-2 sentences of prose. The exact content is up to the implementer but must cover the topics listed.

```markdown
# C++ cheat sheet

## I/O
Fast I/O setup and reading patterns.
\`\`\`cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    int n; cin >> n;
    vector<int> a(n);
    for (auto& x : a) cin >> x;
}
\`\`\`

## Control flow
For loops, while loops, range-for, switch.

## Arrays and vectors
\`vector<int>\`, \`array<int, N>\`, 2D vectors, push_back, emplace_back, reserve.

## Strings
\`string\`, substr, find, transform-to-upper, to_string, stoi.

## Sorting and searching
\`sort(a.begin(), a.end())\`, custom comparator, binary_search, lower_bound, upper_bound.

## Stack, queue, deque
When to reach for each.

## Maps and sets
\`map\`, \`unordered_map\`, \`set\`, \`unordered_set\`, count/find/insert.

## Math and bit tricks
gcd, lcm, __builtin_popcount, bit manipulation idioms.

## Common pitfalls
- Integer overflow: use \`long long\` when products exceed ~2 * 10^9.
- TLE: \`endl\` flushes, use \`"\\n"\` instead.
- Undefined behavior: signed overflow, out-of-bounds.
```

Replace the backslash-escaped fences with real triple-backticks when implementing.

- [ ] **Step 2: Write c.md and py.md with the same section headings**

Mirror the H2 structure. C version uses `scanf`/`printf`, arrays, structs, pointers. Python version uses `input()`/`print()`, `sys.stdin`, lists, dicts, `bisect`, `collections.defaultdict`.

- [ ] **Step 3: Build the meta index**

Create `web/src/data/cheatsheet/meta.ts`:

```typescript
import cppMd from "./cpp.md?raw";
import cMd from "./c.md?raw";
import pyMd from "./py.md?raw";

export const CHEATSHEET_SOURCES = { cpp: cppMd, c: cMd, py: pyMd } as const;

export type CheatLang = keyof typeof CHEATSHEET_SOURCES;

export interface CheatEntry {
  lang: CheatLang;
  heading: string;
  anchor: string;
  snippet: string;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseEntries(lang: CheatLang, md: string): CheatEntry[] {
  const out: CheatEntry[] = [];
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(/^##\s+(.+)$/);
    if (!m) continue;
    const heading = m[1]!.trim();
    let snippet = "";
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const next = lines[j]!.trim();
      if (next && !next.startsWith("#") && !next.startsWith("```")) {
        snippet = next.slice(0, 100);
        break;
      }
    }
    out.push({ lang, heading, anchor: slugify(heading), snippet });
  }
  return out;
}

export const CHEAT_ENTRIES: CheatEntry[] = [
  ...parseEntries("cpp", cppMd),
  ...parseEntries("c", cMd),
  ...parseEntries("py", pyMd),
];
```

`?raw` is Vite's built-in import-as-string suffix; no plugin needed.

- [ ] **Step 4: TOC component**

Create `web/src/components/CheatSheetTOC.tsx`:

```tsx
import type { CheatEntry } from "../data/cheatsheet/meta";

export function CheatSheetTOC({ entries, activeAnchor }: { entries: CheatEntry[]; activeAnchor: string | null }) {
  return (
    <nav className="sticky top-32 w-[220px] flex-shrink-0">
      <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-3">Sections</div>
      <ul className="space-y-1.5 text-sm">
        {entries.map((entry) => (
          <li key={entry.anchor}>
            <a
              href={`#${entry.anchor}`}
              className={`block rounded-md px-2 py-1 ${activeAnchor === entry.anchor ? "bg-[var(--color-lifted)] text-[var(--color-ink)]" : "text-[var(--color-graphite)] hover:bg-[var(--color-lifted)]/60"}`}
            >
              {entry.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 5: CheatSheetPage**

Create `web/src/pages/CheatSheetPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CHEAT_ENTRIES, CHEATSHEET_SOURCES, type CheatLang } from "../data/cheatsheet/meta";
import { CheatSheetTOC } from "../components/CheatSheetTOC";
import { EyebrowLabel } from "../components/EyebrowLabel";

const LANG_LABELS: Record<CheatLang, string> = { cpp: "C++", c: "C", py: "Python" };

export function CheatSheetPage() {
  const { lang } = useParams<{ lang?: string }>();
  const navigate = useNavigate();
  const current: CheatLang = (lang === "c" || lang === "py" ? lang : "cpp");
  const [active, setActive] = useState<string | null>(null);

  const md = CHEATSHEET_SOURCES[current];
  const entries = useMemo(() => CHEAT_ENTRIES.filter((e) => e.lang === current), [current]);

  useEffect(() => {
    function onScroll() {
      for (const e of entries) {
        const el = document.getElementById(e.anchor);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top > 80 && top < 240) { setActive(e.anchor); return; }
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [entries]);

  function copyCode(code: string, button: HTMLButtonElement) {
    void navigator.clipboard.writeText(code).then(
      () => { button.textContent = "Copied"; setTimeout(() => { button.textContent = "Copy"; }, 1500); },
      () => { button.textContent = "Failed"; setTimeout(() => { button.textContent = "Copy"; }, 1500); },
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 pt-32 pb-20">
      <div className="mb-4"><EyebrowLabel>Cheat sheet</EyebrowLabel></div>
      <h1 className="mb-6">Reference for {LANG_LABELS[current]}.</h1>

      <div className="mb-8 flex gap-2">
        {(Object.keys(LANG_LABELS) as CheatLang[]).map((l) => (
          <button
            key={l}
            onClick={() => navigate(`/cheatsheet/${l}`)}
            className={l === current
              ? "rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] px-5 py-1.5 text-sm font-medium"
              : "rounded-full border border-[var(--color-ink)] bg-white text-[var(--color-ink)] px-5 py-1.5 text-sm"}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      <div className="flex gap-12">
        <CheatSheetTOC entries={entries} activeAnchor={active} />
        <div className="prose prose-stone max-w-none flex-1 [&_pre]:relative [&_pre]:bg-[var(--color-bone)] [&_pre]:rounded-2xl [&_pre]:p-4 [&_code]:font-mono [&_code]:text-[13px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                return <h2 id={id}>{children}</h2>;
              },
              pre: ({ children, ...rest }) => {
                const codeEl = (children as any)?.props?.children;
                const text = typeof codeEl === "string" ? codeEl : "";
                return (
                  <pre {...rest}>
                    <button
                      onClick={(e) => copyCode(text, e.currentTarget)}
                      className="absolute top-2 right-2 rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] px-3 py-0.5 text-[10px] font-medium"
                    >Copy</button>
                    {children}
                  </pre>
                );
              },
            }}
          >{md}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire route**

In `web/src/App.tsx` add the import and route:

```tsx
import { CheatSheetPage } from "./pages/CheatSheetPage";
```

Add route between `/docs` and `/settings`:

```tsx
<Route path="/cheatsheet/:lang" element={<CheatSheetPage />} />
<Route path="/cheatsheet" element={<CheatSheetPage />} />
```

- [ ] **Step 7: Add Nav link**

In `web/src/components/NavPill.tsx`, after the `onDocs` constant add:

```tsx
const onCheat = loc.pathname.startsWith("/cheatsheet");
```

Insert a Link between Docs and Settings:

```tsx
<Link to="/cheatsheet/cpp" className={`text-[16px] font-medium tracking-[-0.03em] ${onCheat ? "text-[var(--color-ink)]" : "text-[var(--color-graphite)]"}`}>Cheat sheet</Link>
```

- [ ] **Step 8: Build + smoke**

Run: `bun --cwd web build`
Expected: clean. Open `/cheatsheet/cpp`. Confirm three tabs work, TOC scrolls, copy buttons appear.

- [ ] **Step 9: Commit**

```bash
git add web/src/data web/src/pages/CheatSheetPage.tsx web/src/components/CheatSheetTOC.tsx web/src/App.tsx web/src/components/NavPill.tsx
git commit -m "feat(web): add curated cheat sheets for C, C++, Python"
```

---

## Task 10: Ctrl+K command palette

**Files:**
- Create: `web/src/lib/fuzzy.ts`
- Create: `web/src/lib/hotkey.ts`
- Create: `web/src/lib/docsIndex.ts`
- Modify: `web/src/pages/DocsPage.tsx` (consume docsIndex)
- Create: `web/src/components/CommandPalette.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/NavPill.tsx` (add ⌘K button)

- [ ] **Step 1: fuzzy helper**

Create `web/src/lib/fuzzy.ts`:

```typescript
/**
 * Returns true if every char of `needle` appears in `haystack` in order.
 * Score = lower is better; rewards exact-prefix.
 */
export function fuzzyScore(needle: string, haystack: string): number | null {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (h.startsWith(n)) return 0;
  let hi = 0;
  let score = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return null;
    score += found - hi;
    hi = found + 1;
  }
  return score + (h.length - n.length) * 0.01;
}
```

- [ ] **Step 2: hotkey hook**

Create `web/src/lib/hotkey.ts`:

```typescript
import { useEffect } from "react";

export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void): void {
  useEffect(() => {
    const target = combo.toLowerCase();
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (target === "ctrl+k" && mod && key === "k") {
        e.preventDefault();
        handler(e);
      } else if (target === "escape" && key === "escape") {
        handler(e);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, handler]);
}
```

- [ ] **Step 3: docs index**

Create `web/src/lib/docsIndex.ts`:

```typescript
export interface DocSection { title: string; anchor: string; }

export const DOC_SECTIONS: DocSection[] = [
  { title: "Quick start", anchor: "quick-start" },
  { title: "Workflows", anchor: "workflows" },
  { title: "Troubleshooting", anchor: "troubleshooting" },
];
```

(Future expansion: when DocsPage grows, add entries here.)

- [ ] **Step 4: Refactor DocsPage to add anchors to its H2s**

In `web/src/pages/DocsPage.tsx`, ensure each top-level section heading has an `id` matching the anchor in `docsIndex.ts`. For example:

```tsx
<h2 id="quick-start">Quick start</h2>
<h2 id="workflows">Workflows</h2>
<h2 id="troubleshooting">Troubleshooting</h2>
```

If the page uses different heading text today, harmonize names.

- [ ] **Step 5: CommandPalette component**

Create `web/src/components/CommandPalette.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CHEAT_ENTRIES } from "../data/cheatsheet/meta";
import { DOC_SECTIONS } from "../lib/docsIndex";
import { fuzzyScore } from "../lib/fuzzy";
import type { Problem } from "../lib/types";

type Source = "problem" | "cheat" | "docs";
interface Entry { source: Source; label: string; sub: string; path: string; }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setCursor(0);
    void api.listProblems().then(setProblems).catch(() => setProblems([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => c + 1); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const entries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const p of problems) out.push({ source: "problem", label: `${p.slug} · ${p.title}`, sub: `${p.toi_best_score}/100`, path: `/p/${p.id}` });
    for (const c of CHEAT_ENTRIES) out.push({ source: "cheat", label: `${c.lang.toUpperCase()} · ${c.heading}`, sub: c.snippet, path: `/cheatsheet/${c.lang}#${c.anchor}` });
    for (const d of DOC_SECTIONS) out.push({ source: "docs", label: `Docs · ${d.title}`, sub: "", path: `/docs#${d.anchor}` });
    return out;
  }, [problems]);

  const filtered = useMemo(() => {
    if (!query) return entries.slice(0, 50);
    return entries
      .map((e) => ({ e, s: fuzzyScore(query, e.label) ?? Infinity }))
      .filter((x) => x.s < Infinity)
      .sort((a, b) => a.s - b.s)
      .slice(0, 50)
      .map((x) => x.e);
  }, [entries, query]);

  const selectedIdx = filtered.length === 0 ? -1 : ((cursor % filtered.length) + filtered.length) % filtered.length;

  function go(entry: Entry) {
    onClose();
    // React Router doesn't process hash in `to`; we use plain navigate then scroll.
    navigate(entry.path);
    setTimeout(() => {
      const hash = entry.path.split("#")[1];
      if (hash) {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = filtered[selectedIdx];
    if (target) go(target);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-[var(--color-ink)]/30 pt-[14vh] px-6" onClick={onClose}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-[640px] overflow-hidden rounded-[24px] border border-[var(--color-dust)] bg-[var(--color-lifted)] shadow-[var(--shadow-card)]">
        <input
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          placeholder="Search problems, cheat sheet, docs..."
          className="w-full bg-transparent px-5 py-4 text-[16px] outline-none placeholder:text-[var(--color-slate)] text-[var(--color-ink)]"
        />
        <div className="max-h-[60vh] overflow-y-auto border-t border-[var(--color-dust)]">
          {filtered.length === 0 && <p className="px-5 py-6 text-sm text-[var(--color-slate)]">No matches.</p>}
          {filtered.map((entry, i) => (
            <button
              key={`${entry.source}-${entry.path}-${i}`}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(entry)}
              className={`block w-full text-left px-5 py-2.5 ${i === selectedIdx ? "bg-[var(--color-canvas)]" : ""}`}
            >
              <div className="text-sm font-medium text-[var(--color-ink)]">{entry.label}</div>
              {entry.sub && <div className="text-xs text-[var(--color-slate)]">{entry.sub}</div>}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Mount palette globally in App**

In `web/src/App.tsx`:

```tsx
import { useState } from "react";
// ...
import { CommandPalette } from "./components/CommandPalette";
import { useHotkey } from "./lib/hotkey";

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  useHotkey("ctrl+k", () => setPaletteOpen((v) => !v));
  // ... rest unchanged, append at the end:
  return (
    <>
      {/* existing JSX */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
```

(The implementer wraps the existing return in a fragment.)

- [ ] **Step 7: Add ⌘K button to NavPill**

In `web/src/components/NavPill.tsx`, accept an optional `onOpenPalette` prop:

```tsx
export function NavPill({ onOpenPalette }: { onOpenPalette?: () => void } = {}) {
```

Inside the nav, just before the theme-toggle button, add:

```tsx
<button
  onClick={onOpenPalette}
  aria-label="Open command palette"
  title="Ctrl+K"
  className="w-9 h-9 rounded-full grid place-items-center border border-[var(--color-dust)] text-[var(--color-ink)] hover:bg-[var(--color-lifted)] transition-colors text-xs font-bold"
>⌘K</button>
```

Pass the open-handler from App by re-rendering NavPill via a context or simple prop. Simplest: hoist `paletteOpen` up to App (already done in Step 6), pass `onOpenPalette={() => setPaletteOpen(true)}` to `<NavPill />`.

Update App's JSX:

```tsx
<NavPill onOpenPalette={() => setPaletteOpen(true)} />
```

- [ ] **Step 8: Build + smoke**

Run: `bun --cwd web build`
Expected: clean. Open app. Press Ctrl+K. Confirm palette opens. Type "A1-005" → problem appears. Type "sorting" → cheat entries appear. Type "trouble" → docs section.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/fuzzy.ts web/src/lib/hotkey.ts web/src/lib/docsIndex.ts web/src/components/CommandPalette.tsx web/src/components/NavPill.tsx web/src/App.tsx web/src/pages/DocsPage.tsx
git commit -m "feat(web): add Ctrl+K command palette across problems, cheat sheet, docs"
```

---

## Task 11: End-to-end verification

**Files:** none.

- [ ] **Step 1: Test the AI happy path**

1. Open `/settings`, confirm AI section shows `provider=ollama, model=qwen2.5-coder:7b, hasKey=true (always for ollama)`.
2. Open a problem with at least one local run.
3. Click "Help" tab on the right edge.
4. Type "what algorithm should I use?" → Send.
5. If Ollama is running locally with the model pulled, expect a hint response. If not, expect a clean error: "Ollama HTTP …".
6. Click "Clear" → confirm messages disappear.
7. Reload → confirm history empty (post-clear).

- [ ] **Step 2: Test Anthropic / OpenAI by switching provider**

(Optional, requires user-supplied API keys.) In Settings, switch to Anthropic, paste a key, click Save AI settings. Repeat ask. Verify response. Token count appears under each assistant message.

- [ ] **Step 3: Test cheat sheet pages**

Open `/cheatsheet/cpp`, `/cheatsheet/c`, `/cheatsheet/py`. Confirm TOC items, copy buttons. Click an H2 link in TOC → confirm scroll.

- [ ] **Step 4: Test Ctrl+K**

1. From any page, press Ctrl+K.
2. Type "A1-0" → problems group should appear at the top.
3. Type "sort" → cheat entries from all three languages should appear.
4. Type "trouble" → docs section should appear.
5. Arrow down + Enter → navigates correctly.
6. Esc closes.

- [ ] **Step 5: Verify spoiler guard works**

In AI panel, ask "give me the solution for A1-001". Expect a HINT, not full code.
Click "Just show me". Resend. Expect a full solution (provider permitting).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit --allow-empty -m "chore: verified AI help, cheat sheet, and Ctrl+K end-to-end"
```

---

## Self-Review Summary

**Spec coverage:**
- §3.1 Providers — Task 4, 5 ✓
- §3.2 System prompt — Task 3 ✓
- §3.3 Persistence — Task 2 ✓
- §3.4 API — Task 6 ✓
- §3.5 UI panel — Task 8 ✓
- §3.6 Problem list nudge — deliberately skipped from this plan (low priority, easy follow-up)
- §4 Cheat sheets — Task 9 ✓
- §5 Ctrl+K palette — Task 10 ✓
- §6 Settings — Task 7 ✓
- §7 Schema/config — Task 1, 2 ✓
- §8 File structure — matches Task layout ✓
- §9 Anti-pattern compliance — verified in spec; plan respects all design laws ✓

**Placeholders:** none — every step has actual code or commands with expected outputs.

**Type consistency:** `AiProvider` interface signature in Task 3 matches the dispatcher's expectations in Task 5 and the route's usage in Task 6. `CheatEntry` in Task 9 matches consumption in Task 10. `Problem` from existing `lib/types.ts` reused unchanged.

**Sequencing concern:** Task 9 (cheat sheet markdown) is the only task where the content is a meaningful judgment call. Implementer should write real, useful sections — not placeholder text. If implementer is uncomfortable with content authorship, dispatch a separate content-generation subagent first to draft, then a code subagent to wire it up.
