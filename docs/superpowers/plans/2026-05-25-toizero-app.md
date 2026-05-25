# TOIZero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user, Mastercard-themed practice app for TOI Zero (Thailand Olympiad in Informatics — pre-camp prep) problems with local C/C++ judging and "submit-through" forwarding to TOI's official grader. The user writes code in a Monaco editor, hits Run to test against samples locally, and hits Submit to ship to TOI via a captured network call.

**Architecture:** Single-process Bun app. Hono serves a JSON API on localhost; Vite-built React SPA is served as static assets by the same process. SQLite (`bun:sqlite`) is the only persistence; problem images live on disk under `problems/<slug>/img/`. The judge engine is a Bun module that shells out to `g++`/`gcc` via `child_process`, enforces time limits, and compares output with trailing-whitespace tolerance. TOI submit-through is a Hono route that mimics a reverse-engineered POST request, with the user's session cookie stored in a gitignored `settings.json`.

**Tech Stack:** Bun (runtime + SQLite + bundler + test), Hono (API), Vite + React 18 + TypeScript (frontend), TailwindCSS v4 (Mastercard design tokens), Monaco Editor (`@monaco-editor/react`), Zod (schema validation at API boundary), `bun:test` (testing). External: `g++` / `gcc` already installed on user's PATH.

**Design source of truth:** [info/DESIGN.md](../../../info/DESIGN.md) — the Mastercard design spec. Every visual decision in this plan refers back to it.

**Excluded from v1 (deferred — do not build):**
- Global dashboard / streaks / stats page
- Settings UI (use `settings.json` by hand)
- TOI submission history page (the `toi_submission` table is created and written, but no dedicated page renders it on day one)
- MLE verdict (memory limit enforcement) — Windows Job Objects are annoying; skipped
- Multi-user, auth, profiles, leaderboards, social

---

## File Structure

```
TOIZERO/
├── info/
│   └── DESIGN.md                          (existing — Mastercard spec)
├── docs/
│   └── superpowers/plans/                 (this plan)
├── package.json                            (Bun workspaces root)
├── tsconfig.json                           (shared TS config)
├── .gitignore
├── .editorconfig
├── settings.example.json                   (template, committed)
├── settings.json                           (gitignored — TOI cookie, paths)
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                        (Bun entry; boots Hono + serves frontend)
│   │   ├── config.ts                       (loads settings.json + env)
│   │   ├── db/
│   │   │   ├── client.ts                   (opens SQLite, runs migrations)
│   │   │   ├── schema.sql                  (CREATE TABLE statements)
│   │   │   └── repo/
│   │   │       ├── problems.ts             (CRUD on problems + tests)
│   │   │       ├── solutions.ts            (CRUD on solutions)
│   │   │       ├── runs.ts                 (CRUD on local runs)
│   │   │       └── toi_submissions.ts      (CRUD on TOI submissions)
│   │   ├── judge/
│   │   │   ├── compile.ts                  (g++/gcc invocation)
│   │   │   ├── execute.ts                  (run binary with timeout, capture I/O)
│   │   │   ├── compare.ts                  (trailing-whitespace-tolerant diff)
│   │   │   ├── runJudge.ts                 (orchestrates compile→run-each-test→verdict)
│   │   │   ├── verdicts.ts                 (verdict enum + types)
│   │   │   └── workdir.ts                  (tmp dir helpers)
│   │   ├── api/
│   │   │   ├── problems.ts                 (Hono routes /api/problems*)
│   │   │   ├── runs.ts                     (Hono routes /api/runs*)
│   │   │   ├── solutions.ts                (Hono routes /api/solutions*)
│   │   │   └── toi.ts                      (Hono routes /api/toi/*)
│   │   └── toi/
│   │       └── submit.ts                   (fetch-based mimic of TOI POST)
│   └── tests/
│       ├── judge/
│       │   ├── compile.test.ts
│       │   ├── execute.test.ts
│       │   ├── compare.test.ts
│       │   └── runJudge.test.ts
│       ├── db/
│       │   └── repo.test.ts
│       └── fixtures/
│           ├── ac.cpp                       (always prints expected)
│           ├── wa.cpp                       (prints wrong)
│           ├── tle.cpp                      (infinite loop)
│           ├── re.cpp                       (divide by zero)
│           ├── ce.cpp                       (intentional compile error)
│           └── stdio_echo.cpp               (reads from stdin)
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── tailwind.config.ts                  (Mastercard design tokens)
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.tsx                        (React entry)
│   │   ├── App.tsx                         (router)
│   │   ├── styles/
│   │   │   ├── globals.css                 (Tailwind directives, font-face)
│   │   │   └── tokens.css                  (CSS custom props for design tokens)
│   │   ├── lib/
│   │   │   ├── api.ts                      (typed fetch wrapper)
│   │   │   └── types.ts                    (TS types shared with server)
│   │   ├── components/
│   │   │   ├── NavPill.tsx                 (floating Mastercard nav)
│   │   │   ├── PillButton.tsx              (primary/secondary/orange pill)
│   │   │   ├── EyebrowLabel.tsx            (• SERVICES style label)
│   │   │   ├── ProblemCircle.tsx           (circular portrait card)
│   │   │   ├── SatelliteCTA.tsx            (white arrow circle docked on portraits)
│   │   │   ├── OrbitalArc.tsx              (SVG curved orange arc)
│   │   │   ├── MarkdownRender.tsx          (renders problem statements)
│   │   │   ├── CodeEditor.tsx              (Monaco wrapper)
│   │   │   ├── TestResultsPanel.tsx        (verdict + per-test breakdown)
│   │   │   └── RunHistoryList.tsx          (last N runs)
│   │   └── pages/
│   │       ├── ProblemListPage.tsx
│   │       ├── ProblemWorkspacePage.tsx
│   │       └── ProblemEditModal.tsx        (used inside list page)
│   └── public/
│       └── fonts/
│           └── (Sofia Sans woff2 files — Mastercard fallback)
└── problems/                                (gitignored after seeding)
    └── <slug>/
        └── img/                             (problem statement images)
```

**Decomposition rationale:**
- `server/` and `web/` are independent Bun packages so the frontend can be developed (and unit-tested) without booting the API, and the API can be tested headlessly.
- `judge/` is split by step (compile / execute / compare / orchestrate) because each step has distinct failure modes and deserves isolated tests.
- `db/repo/` is split per table so each file stays focused on one entity.
- `web/components/` are split per visual primitive — the Mastercard design has very specific shapes (circle portrait, satellite, orbital arc) that each deserve a dedicated component.

---

## Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.editorconfig`, `settings.example.json`, `README.md`
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`

- [ ] **Step 1: Verify Bun is installed**

Run: `bun --version`
Expected: prints a version like `1.1.x` or later. If not installed, run in PowerShell: `powershell -c "irm bun.sh/install.ps1 | iex"` then reopen the shell.

- [ ] **Step 2: Initialize root workspace**

Create `package.json`:

```json
{
  "name": "toizero",
  "private": true,
  "type": "module",
  "workspaces": ["server", "web"],
  "scripts": {
    "dev": "bun --filter '*' dev",
    "dev:server": "bun --cwd server dev",
    "dev:web": "bun --cwd web dev",
    "build:web": "bun --cwd web build",
    "start": "bun --cwd server start",
    "test": "bun --cwd server test"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "types": ["bun-types"]
  }
}
```

Create `.gitignore`:

```
node_modules/
dist/
.toizero/
problems/
toizero.db
toizero.db-journal
toizero.db-wal
toizero.db-shm
settings.json
.DS_Store
.env
.env.local
*.log
.vscode/
.idea/
```

Create `.editorconfig`:

```
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

Create `settings.example.json`:

```json
{
  "dataDir": ".toizero",
  "dbPath": ".toizero/toizero.db",
  "problemsDir": "problems",
  "port": 5173,
  "apiPort": 8787,
  "compiler": {
    "cpp": { "bin": "g++", "flags": ["-O2", "-std=c++17", "-Wall", "-Wextra", "-static"] },
    "c":   { "bin": "gcc", "flags": ["-O2", "-std=c11", "-Wall", "-Wextra", "-static"] }
  },
  "toi": {
    "submitUrl": "",
    "cookie": "",
    "extraHeaders": {}
  }
}
```

- [ ] **Step 3: Initialize server package**

Create `server/package.json`:

```json
{
  "name": "@toizero/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.5.0"
  }
}
```

Create `server/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "include": ["src/**/*", "tests/**/*"]
}
```

Create `server/src/index.ts` (placeholder, expanded in Task 10):

```typescript
import { Hono } from "hono";

const app = new Hono();
app.get("/api/health", (c) => c.json({ ok: true }));

const port = Number(process.env.PORT ?? 8787);
console.log(`TOIZero server listening on http://localhost:${port}`);
export default { fetch: app.fetch, port };
```

- [ ] **Step 4: Initialize web package**

Create `web/package.json`:

```json
{
  "name": "@toizero/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "@monaco-editor/react": "^4.6.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "tailwindcss": "^4.0.0-beta.0",
    "@tailwindcss/vite": "^4.0.0-beta.0",
    "typescript": "^5.5.0"
  }
}
```

Create `web/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
```

Create `web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TOIZero</title>
    <link rel="stylesheet" href="/src/styles/globals.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `web/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

Create `web/src/App.tsx`:

```tsx
export default function App() {
  return <div className="p-12 text-3xl">TOIZero — scaffolded.</div>;
}
```

Create `web/src/styles/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 5: Install dependencies**

Run from project root: `bun install`
Expected: dependencies resolve in `node_modules`, no error output.

- [ ] **Step 6: Sanity-boot both packages**

Run in two terminals:
- `bun run dev:server` — expect: `TOIZero server listening on http://localhost:8787`
- `bun run dev:web` — expect: Vite dev server URL printed.

Open `http://localhost:5173` — expect: "TOIZero — scaffolded." renders.
Open `http://localhost:5173/api/health` — expect: `{"ok": true}`.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Bun + Hono + Vite + React workspace"
```

---

## Task 2: Mastercard design tokens (Tailwind v4)

**Files:**
- Create: `web/src/styles/tokens.css`
- Modify: `web/src/styles/globals.css`
- Modify: `web/src/App.tsx` (token smoke test)

- [ ] **Step 1: Define design tokens as CSS custom properties**

Create `web/src/styles/tokens.css` (values copied verbatim from `info/DESIGN.md`):

```css
@theme {
  /* Color: Surfaces */
  --color-canvas: #F3F0EE;
  --color-lifted: #FCFBFA;
  --color-white: #FFFFFF;
  --color-bone: #F4F4F4;

  /* Color: Ink */
  --color-ink: #141413;
  --color-charcoal: #262627;
  --color-slate: #696969;
  --color-granite: #555555;
  --color-graphite: #565656;
  --color-dust: #D1CDC7;
  --color-whisper: #E8E2DA;

  /* Color: Signal */
  --color-signal: #CF4500;
  --color-signal-light: #F37338;
  --color-clay: #9A3A0A;

  /* Color: Semantic */
  --color-link: #3860BE;

  /* Color: Brand mark (never UI) */
  --color-mc-red: #EB001B;
  --color-mc-yellow: #F79E1B;

  /* Radius scale (Mastercard's unusual three-tier system) */
  --radius-micro: 4px;
  --radius-btn: 20px;
  --radius-consent: 24px;
  --radius-hero: 40px;
  --radius-pill: 999px;
  --radius-circle: 9999px;

  /* Font family */
  --font-sans: "Sofia Sans", "Inter", system-ui, sans-serif;

  /* Shadow (atmospheric, never directional) */
  --shadow-nav: 0 4px 24px 0 rgba(0, 0, 0, 0.04);
  --shadow-card: 0 24px 48px 0 rgba(0, 0, 0, 0.08);
  --shadow-feature: 0 70px 110px 0 rgba(0, 0, 0, 0.25);
}
```

- [ ] **Step 2: Wire tokens into globals.css with font setup**

Replace `web/src/styles/globals.css` with:

```css
@import "tailwindcss";
@import "./tokens.css";

@font-face {
  font-family: "Sofia Sans";
  font-weight: 400 700;
  font-display: swap;
  src: local("Sofia Sans"), url("/fonts/sofia-sans-variable.woff2") format("woff2");
}

html, body, #root {
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-weight: 450;
  line-height: 1.4;
  letter-spacing: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
}

/* Headlines use weight 500 + tight -2% tracking per DESIGN.md */
h1, h2, h3, h4 {
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.0;
}
h1 { font-size: 64px; line-height: 64px; }
h2 { font-size: 36px; line-height: 44px; }
h3 { font-size: 24px; line-height: 28.8px; }
```

- [ ] **Step 3: Download Sofia Sans variable font**

Run from `web/public/fonts/`:

```bash
mkdir -p web/public/fonts
curl -L -o web/public/fonts/sofia-sans-variable.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/sofia-sans:vf@latest/latin-wght-normal.woff2"
```

If `curl` is not on PATH, use PowerShell:

```powershell
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/fontsource/fonts/sofia-sans:vf@latest/latin-wght-normal.woff2" -OutFile "web\public\fonts\sofia-sans-variable.woff2"
```

Expected: file exists, ~30–80KB.

- [ ] **Step 4: Smoke-test tokens in App.tsx**

Replace `web/src/App.tsx`:

```tsx
export default function App() {
  return (
    <div className="min-h-screen p-16">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-signal-light)]" />
        <span className="text-[14px] font-bold tracking-[0.04em] uppercase">SCAFFOLD</span>
      </div>
      <h1 className="mb-8">TOIZero design tokens are live.</h1>
      <div className="flex gap-4">
        <button className="bg-[var(--color-ink)] text-[var(--color-canvas)] rounded-[20px] px-6 py-1.5 font-medium">
          Primary
        </button>
        <button className="bg-white text-[var(--color-ink)] rounded-[20px] px-6 py-1.5 font-[450] border-[1.5px] border-[var(--color-ink)]">
          Secondary
        </button>
        <button className="bg-[var(--color-signal)] text-white rounded-[24px] px-7 py-1 text-[13px]">
          Consent
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Visually verify in browser**

Run: `bun run dev:web`. Open `http://localhost:5173`. Confirm:
- Background is warm cream, NOT pure white. Hold a piece of white paper to your screen; the screen should look more yellow/beige.
- Headline reads "TOIZero design tokens are live." in Sofia Sans, weight 500, tight tracking.
- Three buttons: black pill (cream text), white pill (black outline + text), orange pill (white text).
- Eyebrow "SCAFFOLD" with tiny orange dot before it, uppercase, bold, tracked out.

If any of those look wrong, fix tokens before moving on.

- [ ] **Step 6: Commit**

```bash
git add web/src/styles web/src/App.tsx web/public/fonts/ web/index.html
git commit -m "feat(web): add Mastercard design tokens and Sofia Sans"
```

---

## Task 3: SQLite schema and repository

**Files:**
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/client.ts`
- Create: `server/src/db/repo/problems.ts`
- Create: `server/src/db/repo/solutions.ts`
- Create: `server/src/db/repo/runs.ts`
- Create: `server/src/db/repo/toi_submissions.ts`
- Create: `server/tests/db/repo.test.ts`

- [ ] **Step 1: Write the schema**

Create `server/src/db/schema.sql`:

```sql
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
  io_mode      TEXT NOT NULL DEFAULT 'stdio',  -- 'stdio' or 'file:<base>'
  source_url   TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_case (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id    INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                       -- 'sample' or 'extra'
  subtask       TEXT NOT NULL DEFAULT 'main',        -- 'main', 'subtask1', ...
  idx           INTEGER NOT NULL,                    -- display order
  input_text    TEXT NOT NULL,
  expected_text TEXT NOT NULL,
  explanation_md TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_test_case_problem ON test_case(problem_id);

CREATE TABLE IF NOT EXISTS solution (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL UNIQUE REFERENCES problem(id) ON DELETE CASCADE,
  language   TEXT NOT NULL,                          -- 'c' or 'cpp'
  code       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS run (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id      INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
  language        TEXT NOT NULL,
  code_snapshot   TEXT NOT NULL,
  verdict         TEXT NOT NULL,   -- 'AC' | 'WA' | 'TLE' | 'RE' | 'CE'
  total_runtime_ms INTEGER NOT NULL DEFAULT 0,
  per_test_json   TEXT NOT NULL,   -- JSON array of per-test results
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_run_problem ON run(problem_id, created_at DESC);

CREATE TABLE IF NOT EXISTS toi_submission (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id    INTEGER NOT NULL REFERENCES problem(id) ON DELETE CASCADE,
  language      TEXT NOT NULL,
  code_snapshot TEXT NOT NULL,
  http_status   INTEGER,
  response_json TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Write the db client**

Create `server/src/db/client.ts`:

```typescript
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
  return db;
}
```

- [ ] **Step 3: Write the failing repo test**

Create `server/tests/db/repo.test.ts`:

```typescript
import { describe, expect, test, beforeEach } from "bun:test";
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun --cwd server test`
Expected: failures with messages like `Cannot find module './repo/problems'`.

- [ ] **Step 5: Implement problem repo**

Create `server/src/db/repo/problems.ts`:

```typescript
import type { Database } from "bun:sqlite";

export interface CreateProblemInput {
  slug: string;
  title: string;
  statementMd: string;
  inputMd: string;
  outputMd: string;
  category: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  ioMode: string;
  sourceUrl: string;
  sampleTests: { input: string; expected: string; explanationMd: string }[];
  extraTests: { input: string; expected: string; subtask: string }[];
}

export interface ProblemRow {
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
  created_at: string;
  updated_at: string;
}

export interface TestRow {
  id: number;
  problem_id: number;
  kind: "sample" | "extra";
  subtask: string;
  idx: number;
  input_text: string;
  expected_text: string;
  explanation_md: string;
}

export function problemRepo(db: Database) {
  const insertProblem = db.prepare(
    `INSERT INTO problem (slug, title, statement_md, input_md, output_md, category, time_limit_ms, memory_limit_mb, io_mode, source_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTest = db.prepare(
    `INSERT INTO test_case (problem_id, kind, subtask, idx, input_text, expected_text, explanation_md)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const selectById = db.prepare(`SELECT * FROM problem WHERE id = ?`);
  const selectAll = db.prepare(`SELECT * FROM problem ORDER BY created_at DESC, id DESC`);
  const selectTests = db.prepare(`SELECT * FROM test_case WHERE problem_id = ? ORDER BY kind, subtask, idx`);
  const updateProblem = db.prepare(
    `UPDATE problem SET title=?, statement_md=?, input_md=?, output_md=?, category=?, time_limit_ms=?, memory_limit_mb=?, io_mode=?, source_url=?, updated_at=datetime('now') WHERE id=?`
  );
  const deleteTests = db.prepare(`DELETE FROM test_case WHERE problem_id = ?`);
  const deleteProblem = db.prepare(`DELETE FROM problem WHERE id = ?`);

  return {
    create(input: CreateProblemInput): number {
      const tx = db.transaction(() => {
        const info = insertProblem.run(
          input.slug, input.title, input.statementMd, input.inputMd, input.outputMd,
          input.category, input.timeLimitMs, input.memoryLimitMb, input.ioMode, input.sourceUrl
        );
        const id = Number(info.lastInsertRowid);
        input.sampleTests.forEach((t, i) => {
          insertTest.run(id, "sample", "main", i, t.input, t.expected, t.explanationMd);
        });
        input.extraTests.forEach((t, i) => {
          insertTest.run(id, "extra", t.subtask || "main", i, t.input, t.expected, "");
        });
        return id;
      });
      return tx();
    },

    getById(id: number): ProblemRow | null {
      return (selectById.get(id) as ProblemRow | null) ?? null;
    },

    listAll(): ProblemRow[] {
      return selectAll.all() as ProblemRow[];
    },

    getTests(id: number): { samples: TestRow[]; extras: TestRow[] } {
      const rows = selectTests.all(id) as TestRow[];
      return {
        samples: rows.filter((r) => r.kind === "sample"),
        extras: rows.filter((r) => r.kind === "extra"),
      };
    },

    update(id: number, input: CreateProblemInput): void {
      const tx = db.transaction(() => {
        updateProblem.run(
          input.title, input.statementMd, input.inputMd, input.outputMd, input.category,
          input.timeLimitMs, input.memoryLimitMb, input.ioMode, input.sourceUrl, id
        );
        deleteTests.run(id);
        input.sampleTests.forEach((t, i) => {
          insertTest.run(id, "sample", "main", i, t.input, t.expected, t.explanationMd);
        });
        input.extraTests.forEach((t, i) => {
          insertTest.run(id, "extra", t.subtask || "main", i, t.input, t.expected, "");
        });
      });
      tx();
    },

    delete(id: number): void {
      deleteProblem.run(id);
    },
  };
}
```

- [ ] **Step 6: Implement solution repo**

Create `server/src/db/repo/solutions.ts`:

```typescript
import type { Database } from "bun:sqlite";

export interface SolutionRow {
  id: number;
  problem_id: number;
  language: "c" | "cpp";
  code: string;
  updated_at: string;
}

export function solutionRepo(db: Database) {
  const select = db.prepare(`SELECT * FROM solution WHERE problem_id = ?`);
  const upsert = db.prepare(
    `INSERT INTO solution (problem_id, language, code) VALUES (?, ?, ?)
     ON CONFLICT(problem_id) DO UPDATE SET language=excluded.language, code=excluded.code, updated_at=datetime('now')`
  );

  return {
    get(problemId: number): SolutionRow | null {
      return (select.get(problemId) as SolutionRow | null) ?? null;
    },
    upsert(problemId: number, language: "c" | "cpp", code: string): void {
      upsert.run(problemId, language, code);
    },
  };
}
```

- [ ] **Step 7: Implement run repo**

Create `server/src/db/repo/runs.ts`:

```typescript
import type { Database } from "bun:sqlite";

export type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE";

export interface PerTestResult {
  idx: number;
  verdict: Verdict;
  runtimeMs: number;
  stderr: string;
  diff?: string;
}

export interface CreateRunInput {
  problemId: number;
  language: "c" | "cpp";
  codeSnapshot: string;
  verdict: Verdict;
  totalRuntimeMs: number;
  perTest: PerTestResult[];
}

export interface RunRow {
  id: number;
  problem_id: number;
  language: "c" | "cpp";
  code_snapshot: string;
  verdict: Verdict;
  total_runtime_ms: number;
  per_test_json: string;
  created_at: string;
}

export function runRepo(db: Database) {
  const insert = db.prepare(
    `INSERT INTO run (problem_id, language, code_snapshot, verdict, total_runtime_ms, per_test_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const selectRecent = db.prepare(
    `SELECT * FROM run WHERE problem_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`
  );

  return {
    create(input: CreateRunInput): number {
      const info = insert.run(
        input.problemId, input.language, input.codeSnapshot,
        input.verdict, input.totalRuntimeMs, JSON.stringify(input.perTest)
      );
      return Number(info.lastInsertRowid);
    },
    listRecent(problemId: number, limit: number): RunRow[] {
      return selectRecent.all(problemId, limit) as RunRow[];
    },
  };
}
```

- [ ] **Step 8: Implement TOI submission repo**

Create `server/src/db/repo/toi_submissions.ts`:

```typescript
import type { Database } from "bun:sqlite";

export interface CreateToiSubmissionInput {
  problemId: number;
  language: "c" | "cpp";
  codeSnapshot: string;
  httpStatus: number | null;
  responseJson: string | null;
  error: string | null;
}

export function toiSubmissionRepo(db: Database) {
  const insert = db.prepare(
    `INSERT INTO toi_submission (problem_id, language, code_snapshot, http_status, response_json, error)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  return {
    create(input: CreateToiSubmissionInput): number {
      const info = insert.run(
        input.problemId, input.language, input.codeSnapshot,
        input.httpStatus, input.responseJson, input.error
      );
      return Number(info.lastInsertRowid);
    },
  };
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `bun --cwd server test`
Expected: all repo tests PASS.

- [ ] **Step 10: Commit**

```bash
git add server/src/db server/tests/db
git commit -m "feat(db): add SQLite schema and typed repositories"
```

---

## Task 4: Judge engine — compile step (TDD)

**Files:**
- Create: `server/src/judge/workdir.ts`
- Create: `server/src/judge/verdicts.ts`
- Create: `server/src/judge/compile.ts`
- Create: `server/tests/fixtures/ac.cpp`
- Create: `server/tests/fixtures/ce.cpp`
- Create: `server/tests/judge/compile.test.ts`

- [ ] **Step 1: Create fixture C++ files**

Create `server/tests/fixtures/ac.cpp`:

```cpp
#include <iostream>
int main() { std::cout << 42 << std::endl; return 0; }
```

Create `server/tests/fixtures/ce.cpp`:

```cpp
#include <iostream>
int main() { std::cout << notdefined << std::endl; return 0; }
```

- [ ] **Step 2: Write the failing test**

Create `server/tests/judge/compile.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "../../src/judge/compile";
import { makeWorkdir, cleanupWorkdir } from "../../src/judge/workdir";

const FIX = join(import.meta.dir, "..", "fixtures");

describe("compile", () => {
  test("compiles a valid C++ program and reports success", async () => {
    const code = readFileSync(join(FIX, "ac.cpp"), "utf8");
    const wd = await makeWorkdir();
    try {
      const r = await compile({ language: "cpp", code, workdir: wd });
      expect(r.ok).toBe(true);
      expect(r.binaryPath).toBeTruthy();
    } finally {
      await cleanupWorkdir(wd);
    }
  });

  test("returns CE with stderr when compilation fails", async () => {
    const code = readFileSync(join(FIX, "ce.cpp"), "utf8");
    const wd = await makeWorkdir();
    try {
      const r = await compile({ language: "cpp", code, workdir: wd });
      expect(r.ok).toBe(false);
      expect(r.stderr).toContain("notdefined");
    } finally {
      await cleanupWorkdir(wd);
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun --cwd server test tests/judge/compile.test.ts`
Expected: failure — modules don't exist yet.

- [ ] **Step 4: Implement workdir helpers**

Create `server/src/judge/workdir.ts`:

```typescript
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function makeWorkdir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "toizero-"));
}

export async function cleanupWorkdir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
```

- [ ] **Step 5: Implement verdict types**

Create `server/src/judge/verdicts.ts`:

```typescript
export type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE";
export type Language = "c" | "cpp";

export interface CompilerConfig {
  bin: string;
  flags: string[];
}
```

- [ ] **Step 6: Implement compile**

Create `server/src/judge/compile.ts`:

```typescript
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Language, CompilerConfig } from "./verdicts";

export interface CompileInput {
  language: Language;
  code: string;
  workdir: string;
  config?: { c: CompilerConfig; cpp: CompilerConfig };
}

export interface CompileOk {
  ok: true;
  binaryPath: string;
  stderr: string;
}

export interface CompileFail {
  ok: false;
  stderr: string;
}

const DEFAULTS: { c: CompilerConfig; cpp: CompilerConfig } = {
  c:   { bin: "gcc", flags: ["-O2", "-std=c11",   "-Wall", "-Wextra", "-static"] },
  cpp: { bin: "g++", flags: ["-O2", "-std=c++17", "-Wall", "-Wextra", "-static"] },
};

export async function compile(input: CompileInput): Promise<CompileOk | CompileFail> {
  const cfg = input.config ?? DEFAULTS;
  const ext = input.language === "cpp" ? "cpp" : "c";
  const srcPath = join(input.workdir, `solution.${ext}`);
  const binName = process.platform === "win32" ? "solution.exe" : "solution";
  const binaryPath = join(input.workdir, binName);

  await writeFile(srcPath, input.code, "utf8");

  const { bin, flags } = cfg[input.language];
  const args = [...flags, srcPath, "-o", binaryPath];

  return new Promise((resolve) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (b) => { stderr += b.toString(); });
    proc.on("error", (err) => {
      resolve({ ok: false, stderr: `Failed to spawn ${bin}: ${err.message}` });
    });
    proc.on("close", (code) => {
      if (code === 0) resolve({ ok: true, binaryPath, stderr });
      else resolve({ ok: false, stderr });
    });
  });
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `bun --cwd server test tests/judge/compile.test.ts`
Expected: both tests PASS. If "spawn g++ ENOENT", you don't have g++ on PATH (which contradicts your earlier confirmation — fix that first).

- [ ] **Step 8: Commit**

```bash
git add server/src/judge server/tests/judge/compile.test.ts server/tests/fixtures
git commit -m "feat(judge): add compile step with g++/gcc"
```

---

## Task 5: Judge engine — execute with timeout (TDD)

**Files:**
- Create: `server/src/judge/execute.ts`
- Create: `server/tests/fixtures/stdio_echo.cpp`
- Create: `server/tests/fixtures/tle.cpp`
- Create: `server/tests/fixtures/re.cpp`
- Create: `server/tests/judge/execute.test.ts`

- [ ] **Step 1: Create fixtures**

Create `server/tests/fixtures/stdio_echo.cpp`:

```cpp
#include <iostream>
#include <string>
int main() {
  std::string line;
  while (std::getline(std::cin, line)) std::cout << line << "\n";
  return 0;
}
```

Create `server/tests/fixtures/tle.cpp`:

```cpp
int main() { while (true) {} }
```

Create `server/tests/fixtures/re.cpp`:

```cpp
int main() { int* p = nullptr; return *p; }
```

- [ ] **Step 2: Write the failing test**

Create `server/tests/judge/execute.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "../../src/judge/compile";
import { execute } from "../../src/judge/execute";
import { makeWorkdir, cleanupWorkdir } from "../../src/judge/workdir";

const FIX = join(import.meta.dir, "..", "fixtures");

async function build(filename: string) {
  const wd = await makeWorkdir();
  const code = readFileSync(join(FIX, filename), "utf8");
  const r = await compile({ language: "cpp", code, workdir: wd });
  if (!r.ok) throw new Error("compile failed: " + r.stderr);
  return { wd, bin: r.binaryPath };
}

describe("execute", () => {
  test("captures stdout on a normal run", async () => {
    const { wd, bin } = await build("stdio_echo.cpp");
    try {
      const r = await execute({ binaryPath: bin, stdin: "hello\nworld\n", timeoutMs: 1000, workdir: wd });
      expect(r.exit).toBe(0);
      expect(r.stdout).toBe("hello\nworld\n");
      expect(r.timedOut).toBe(false);
    } finally {
      await cleanupWorkdir(wd);
    }
  });

  test("kills the process after timeoutMs and reports timedOut", async () => {
    const { wd, bin } = await build("tle.cpp");
    try {
      const r = await execute({ binaryPath: bin, stdin: "", timeoutMs: 200, workdir: wd });
      expect(r.timedOut).toBe(true);
      expect(r.runtimeMs).toBeGreaterThanOrEqual(200);
    } finally {
      await cleanupWorkdir(wd);
    }
  });

  test("captures non-zero exit on runtime error", async () => {
    const { wd, bin } = await build("re.cpp");
    try {
      const r = await execute({ binaryPath: bin, stdin: "", timeoutMs: 1000, workdir: wd });
      expect(r.timedOut).toBe(false);
      expect(r.exit).not.toBe(0);
    } finally {
      await cleanupWorkdir(wd);
    }
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun --cwd server test tests/judge/execute.test.ts`
Expected: module not found.

- [ ] **Step 4: Implement execute**

Create `server/src/judge/execute.ts`:

```typescript
import { spawn } from "node:child_process";

export interface ExecuteInput {
  binaryPath: string;
  stdin: string;
  timeoutMs: number;
  workdir: string;
}

export interface ExecuteResult {
  exit: number | null;
  stdout: string;
  stderr: string;
  runtimeMs: number;
  timedOut: boolean;
}

export async function execute(input: ExecuteInput): Promise<ExecuteResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const proc = spawn(input.binaryPath, [], {
      cwd: input.workdir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, input.timeoutMs);

    proc.stdout.on("data", (b) => { stdout += b.toString(); });
    proc.stderr.on("data", (b) => { stderr += b.toString(); });

    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exit: null, stdout, stderr: stderr + "\nspawn error: " + err.message,
        runtimeMs: performance.now() - start, timedOut: false,
      });
    });

    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const runtimeMs = performance.now() - start;
      resolve({ exit: code, stdout, stderr, runtimeMs, timedOut });
    });

    try {
      proc.stdin.write(input.stdin);
      proc.stdin.end();
    } catch {
      // ignore — process may have already exited
    }
  });
}
```

- [ ] **Step 5: Run to verify pass**

Run: `bun --cwd server test tests/judge/execute.test.ts`
Expected: all three tests PASS. TLE test may take ~200ms.

- [ ] **Step 6: Commit**

```bash
git add server/src/judge/execute.ts server/tests/judge/execute.test.ts server/tests/fixtures
git commit -m "feat(judge): add execute with timeout and stdin piping"
```

---

## Task 6: Judge engine — output comparison (TDD)

**Files:**
- Create: `server/src/judge/compare.ts`
- Create: `server/tests/judge/compare.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/tests/judge/compare.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { compareOutputs } from "../../src/judge/compare";

describe("compareOutputs", () => {
  test("exact match", () => {
    expect(compareOutputs("3\n", "3\n").ok).toBe(true);
  });
  test("trailing whitespace ignored", () => {
    expect(compareOutputs("3 \n", "3\n").ok).toBe(true);
    expect(compareOutputs("3\n\n\n", "3").ok).toBe(true);
  });
  test("intermediate whitespace matters", () => {
    expect(compareOutputs("1 2\n", "12\n").ok).toBe(false);
  });
  test("blank lines in middle still compared", () => {
    expect(compareOutputs("a\n\nb\n", "a\nb\n").ok).toBe(false);
  });
  test("returns a diff line on mismatch", () => {
    const r = compareOutputs("3\n", "4\n");
    expect(r.ok).toBe(false);
    expect(r.diff).toContain("3");
    expect(r.diff).toContain("4");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun --cwd server test tests/judge/compare.test.ts`

- [ ] **Step 3: Implement compareOutputs**

Create `server/src/judge/compare.ts`:

```typescript
export interface CompareResult {
  ok: boolean;
  diff?: string;
}

function normalize(s: string): string[] {
  // Split by newline, trim trailing whitespace from each line, drop trailing empty lines.
  const lines = s.split(/\r?\n/).map((l) => l.replace(/[ \t]+$/g, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function compareOutputs(actual: string, expected: string): CompareResult {
  const a = normalize(actual);
  const e = normalize(expected);
  if (a.length !== e.length) {
    return { ok: false, diff: makeDiff(a, e) };
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== e[i]) return { ok: false, diff: makeDiff(a, e) };
  }
  return { ok: true };
}

function makeDiff(actual: string[], expected: string[]): string {
  const lines: string[] = [];
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    const a = actual[i] ?? "<EOF>";
    const e = expected[i] ?? "<EOF>";
    if (a === e) lines.push(`  ${a}`);
    else {
      lines.push(`- ${e}`);
      lines.push(`+ ${a}`);
    }
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun --cwd server test tests/judge/compare.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/judge/compare.ts server/tests/judge/compare.test.ts
git commit -m "feat(judge): add output comparison with trailing-whitespace tolerance"
```

---

## Task 7: Judge engine — orchestrator with stdio mode (TDD)

**Files:**
- Create: `server/src/judge/runJudge.ts`
- Create: `server/tests/fixtures/wa.cpp`
- Create: `server/tests/judge/runJudge.test.ts`

- [ ] **Step 1: Create WA fixture**

Create `server/tests/fixtures/wa.cpp`:

```cpp
#include <iostream>
int main() {
  int a, b; std::cin >> a >> b;
  std::cout << (a - b) << std::endl;  // bug: should be +
  return 0;
}
```

- [ ] **Step 2: Write the failing test**

Create `server/tests/judge/runJudge.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runJudge } from "../../src/judge/runJudge";

const FIX = join(import.meta.dir, "..", "fixtures");
const echoCode = readFileSync(join(FIX, "stdio_echo.cpp"), "utf8");
const waCode = readFileSync(join(FIX, "wa.cpp"), "utf8");
const tleCode = readFileSync(join(FIX, "tle.cpp"), "utf8");
const ceCode = readFileSync(join(FIX, "ce.cpp"), "utf8");

describe("runJudge stdio mode", () => {
  test("AC across all sample tests", async () => {
    const r = await runJudge({
      language: "cpp",
      code: echoCode,
      timeLimitMs: 1000,
      ioMode: "stdio",
      tests: [
        { idx: 0, input: "hi\n",  expected: "hi\n"  },
        { idx: 1, input: "bye\n", expected: "bye\n" },
      ],
    });
    expect(r.verdict).toBe("AC");
    expect(r.perTest.every((t) => t.verdict === "AC")).toBe(true);
  });

  test("WA when output differs", async () => {
    const r = await runJudge({
      language: "cpp",
      code: waCode,
      timeLimitMs: 1000,
      ioMode: "stdio",
      tests: [{ idx: 0, input: "2 3\n", expected: "5\n" }],
    });
    expect(r.verdict).toBe("WA");
    expect(r.perTest[0]!.verdict).toBe("WA");
    expect(r.perTest[0]!.diff).toBeTruthy();
  });

  test("TLE when execution exceeds time limit", async () => {
    const r = await runJudge({
      language: "cpp",
      code: tleCode,
      timeLimitMs: 150,
      ioMode: "stdio",
      tests: [{ idx: 0, input: "", expected: "" }],
    });
    expect(r.verdict).toBe("TLE");
  });

  test("CE short-circuits — no per-test runs", async () => {
    const r = await runJudge({
      language: "cpp",
      code: ceCode,
      timeLimitMs: 1000,
      ioMode: "stdio",
      tests: [{ idx: 0, input: "", expected: "" }],
    });
    expect(r.verdict).toBe("CE");
    expect(r.compileStderr).toBeTruthy();
    expect(r.perTest.length).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun --cwd server test tests/judge/runJudge.test.ts`
Expected: module not found.

- [ ] **Step 4: Implement runJudge for stdio mode**

Create `server/src/judge/runJudge.ts`:

```typescript
import { compile } from "./compile";
import { execute } from "./execute";
import { compareOutputs } from "./compare";
import { makeWorkdir, cleanupWorkdir } from "./workdir";
import type { Language, Verdict } from "./verdicts";

export interface JudgeTest {
  idx: number;
  input: string;
  expected: string;
  subtask?: string;
}

export interface JudgeInput {
  language: Language;
  code: string;
  timeLimitMs: number;
  ioMode: string; // 'stdio' or 'file:<base>'
  tests: JudgeTest[];
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

export async function runJudge(input: JudgeInput): Promise<JudgeResult> {
  const wd = await makeWorkdir();
  try {
    const c = await compile({ language: input.language, code: input.code, workdir: wd });
    if (!c.ok) {
      return { verdict: "CE", totalRuntimeMs: 0, perTest: [], compileStderr: c.stderr };
    }

    const perTest: PerTestOutcome[] = [];
    let total = 0;
    let worst: Verdict = "AC";

    for (const t of input.tests) {
      const r = await execute({
        binaryPath: c.binaryPath,
        stdin: input.ioMode === "stdio" ? t.input : "",
        timeoutMs: input.timeLimitMs,
        workdir: wd,
      });
      total += r.runtimeMs;

      let v: Verdict;
      let diff: string | undefined;
      if (r.timedOut) v = "TLE";
      else if (r.exit !== 0) v = "RE";
      else {
        const cmp = compareOutputs(r.stdout, t.expected);
        if (cmp.ok) v = "AC";
        else { v = "WA"; diff = cmp.diff; }
      }

      perTest.push({
        idx: t.idx,
        subtask: t.subtask ?? "main",
        verdict: v,
        runtimeMs: Math.round(r.runtimeMs),
        stderr: r.stderr.slice(0, 4000),
        diff: diff?.slice(0, 4000),
      });

      // Verdict precedence: CE > RE > TLE > WA > AC (worst rules overall verdict)
      worst = combineVerdict(worst, v);
    }

    const subtaskScores = scoreSubtasks(perTest);
    return { verdict: worst, totalRuntimeMs: Math.round(total), perTest, subtaskScores };
  } finally {
    await cleanupWorkdir(wd);
  }
}

const RANK: Record<Verdict, number> = { AC: 0, WA: 1, TLE: 2, RE: 3, CE: 4 };

function combineVerdict(a: Verdict, b: Verdict): Verdict {
  return RANK[b] > RANK[a] ? b : a;
}

function scoreSubtasks(perTest: PerTestOutcome[]): Record<string, { passed: number; total: number }> {
  const out: Record<string, { passed: number; total: number }> = {};
  for (const t of perTest) {
    const k = t.subtask;
    if (!out[k]) out[k] = { passed: 0, total: 0 };
    out[k]!.total += 1;
    if (t.verdict === "AC") out[k]!.passed += 1;
  }
  return out;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `bun --cwd server test tests/judge/runJudge.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/judge/runJudge.ts server/tests/judge/runJudge.test.ts server/tests/fixtures/wa.cpp
git commit -m "feat(judge): orchestrate compile + execute + compare for stdio mode"
```

---

## Task 8: Judge engine — file I/O mode (TDD)

**Files:**
- Modify: `server/src/judge/runJudge.ts`
- Create: `server/tests/fixtures/file_io.cpp`
- Modify: `server/tests/judge/runJudge.test.ts`

- [ ] **Step 1: Create file-I/O fixture**

Create `server/tests/fixtures/file_io.cpp`:

```cpp
#include <cstdio>
int main() {
  std::freopen("train1.in",  "r", stdin);
  std::freopen("train1.out", "w", stdout);
  int a, b; scanf("%d %d", &a, &b);
  printf("%d\n", a + b);
  return 0;
}
```

- [ ] **Step 2: Add a failing file-I/O test**

Append to `server/tests/judge/runJudge.test.ts`:

```typescript
import { readFileSync as _readFileSync } from "node:fs";
const fileIoCode = _readFileSync(join(FIX, "file_io.cpp"), "utf8");

describe("runJudge file mode", () => {
  test("AC when program reads train1.in and writes train1.out", async () => {
    const r = await runJudge({
      language: "cpp",
      code: fileIoCode,
      timeLimitMs: 1000,
      ioMode: "file:train1",
      tests: [{ idx: 0, input: "4 5\n", expected: "9\n" }],
    });
    expect(r.verdict).toBe("AC");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun --cwd server test tests/judge/runJudge.test.ts`
Expected: the new file-I/O test fails (current execute ignores file mode).

- [ ] **Step 4: Add file-mode staging to runJudge**

In `server/src/judge/runJudge.ts`, add imports and modify the per-test loop:

```typescript
import { writeFile, readFile, rm } from "node:fs/promises";
import { join as joinPath } from "node:path";
```

Replace the body of the `for (const t of input.tests)` loop with:

```typescript
    for (const t of input.tests) {
      let stdin = "";
      let inFile: string | null = null;
      let outFile: string | null = null;

      if (input.ioMode.startsWith("file:")) {
        const base = input.ioMode.slice("file:".length);
        inFile  = joinPath(wd, `${base}.in`);
        outFile = joinPath(wd, `${base}.out`);
        await writeFile(inFile, t.input, "utf8");
        // Pre-clear any stale output file from previous test
        await rm(outFile, { force: true });
      } else {
        stdin = t.input;
      }

      const r = await execute({
        binaryPath: c.binaryPath,
        stdin,
        timeoutMs: input.timeLimitMs,
        workdir: wd,
      });
      total += r.runtimeMs;

      let v: Verdict;
      let diff: string | undefined;
      if (r.timedOut) v = "TLE";
      else if (r.exit !== 0) v = "RE";
      else {
        let actual = r.stdout;
        if (outFile) {
          try { actual = await readFile(outFile, "utf8"); }
          catch { actual = ""; }
        }
        const cmp = compareOutputs(actual, t.expected);
        if (cmp.ok) v = "AC";
        else { v = "WA"; diff = cmp.diff; }
      }

      perTest.push({
        idx: t.idx,
        subtask: t.subtask ?? "main",
        verdict: v,
        runtimeMs: Math.round(r.runtimeMs),
        stderr: r.stderr.slice(0, 4000),
        diff: diff?.slice(0, 4000),
      });
      worst = combineVerdict(worst, v);
    }
```

- [ ] **Step 5: Run to verify pass**

Run: `bun --cwd server test tests/judge/runJudge.test.ts`
Expected: all stdio + file-I/O tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/judge/runJudge.ts server/tests/judge/runJudge.test.ts server/tests/fixtures/file_io.cpp
git commit -m "feat(judge): support file I/O mode (freopen-style problems)"
```

---

## Task 9: Hono backend API routes

**Files:**
- Create: `server/src/config.ts`
- Create: `server/src/api/problems.ts`
- Create: `server/src/api/solutions.ts`
- Create: `server/src/api/runs.ts`
- Create: `server/src/api/toi.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Implement config loader**

Create `server/src/config.ts`:

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface AppConfig {
  dataDir: string;
  dbPath: string;
  problemsDir: string;
  port: number;
  apiPort: number;
  compiler: {
    c:   { bin: string; flags: string[] };
    cpp: { bin: string; flags: string[] };
  };
  toi: {
    submitUrl: string;
    cookie: string;
    extraHeaders: Record<string, string>;
  };
}

export function loadConfig(root = process.cwd()): AppConfig {
  const local = join(root, "settings.json");
  const example = join(root, "settings.example.json");
  const path = existsSync(local) ? local : example;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return raw as AppConfig;
}
```

- [ ] **Step 2: Implement problems API**

Create `server/src/api/problems.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { problemRepo } from "../db/repo/problems";

const TestZ = z.object({
  input: z.string(),
  expected: z.string(),
  explanationMd: z.string().default(""),
});
const ExtraTestZ = z.object({
  input: z.string(),
  expected: z.string(),
  subtask: z.string().default("main"),
});
const ProblemZ = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1),
  statementMd: z.string().default(""),
  inputMd: z.string().default(""),
  outputMd: z.string().default(""),
  category: z.string().default("general"),
  timeLimitMs: z.number().int().positive().default(1000),
  memoryLimitMb: z.number().int().positive().default(256),
  ioMode: z.string().default("stdio"),
  sourceUrl: z.string().default(""),
  sampleTests: z.array(TestZ).default([]),
  extraTests: z.array(ExtraTestZ).default([]),
});

export function problemsRouter(db: Database) {
  const r = new Hono();
  const repo = problemRepo(db);

  r.get("/", (c) => c.json(repo.listAll()));

  r.get("/:id", (c) => {
    const id = Number(c.req.param("id"));
    const p = repo.getById(id);
    if (!p) return c.json({ error: "not found" }, 404);
    return c.json({ ...p, tests: repo.getTests(id) });
  });

  r.post("/", async (c) => {
    const body = ProblemZ.parse(await c.req.json());
    const id = repo.create(body);
    return c.json({ id }, 201);
  });

  r.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = ProblemZ.parse(await c.req.json());
    repo.update(id, body);
    return c.json({ ok: true });
  });

  r.delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    repo.delete(id);
    return c.json({ ok: true });
  });

  return r;
}
```

- [ ] **Step 3: Implement solutions API**

Create `server/src/api/solutions.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { solutionRepo } from "../db/repo/solutions";

const SaveZ = z.object({
  language: z.enum(["c", "cpp"]),
  code: z.string(),
});

export function solutionsRouter(db: Database) {
  const r = new Hono();
  const repo = solutionRepo(db);

  r.get("/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    return c.json(repo.get(id) ?? null);
  });

  r.put("/:problemId", async (c) => {
    const id = Number(c.req.param("problemId"));
    const body = SaveZ.parse(await c.req.json());
    repo.upsert(id, body.language, body.code);
    return c.json({ ok: true });
  });

  return r;
}
```

- [ ] **Step 4: Implement runs API**

Create `server/src/api/runs.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import { problemRepo } from "../db/repo/problems";
import { runRepo } from "../db/repo/runs";
import { runJudge } from "../judge/runJudge";
import type { AppConfig } from "../config";

const RunZ = z.object({
  language: z.enum(["c", "cpp"]),
  code: z.string(),
  scope: z.enum(["sample", "all"]).default("sample"),
});

export function runsRouter(db: Database, cfg: AppConfig) {
  const r = new Hono();
  const pRepo = problemRepo(db);
  const rRepo = runRepo(db);

  r.post("/:problemId/run", async (c) => {
    const id = Number(c.req.param("problemId"));
    const p = pRepo.getById(id);
    if (!p) return c.json({ error: "not found" }, 404);
    const body = RunZ.parse(await c.req.json());
    const tests = pRepo.getTests(id);
    const judgeTests = (body.scope === "all" ? [...tests.samples, ...tests.extras] : tests.samples)
      .map((t, i) => ({ idx: i, input: t.input_text, expected: t.expected_text, subtask: t.subtask }));

    const result = await runJudge({
      language: body.language,
      code: body.code,
      timeLimitMs: p.time_limit_ms,
      ioMode: p.io_mode,
      tests: judgeTests,
    });

    rRepo.create({
      problemId: id,
      language: body.language,
      codeSnapshot: body.code,
      verdict: result.verdict,
      totalRuntimeMs: result.totalRuntimeMs,
      perTest: result.perTest.map((t) => ({
        idx: t.idx, verdict: t.verdict, runtimeMs: t.runtimeMs, stderr: t.stderr, diff: t.diff,
      })),
    });

    return c.json(result);
  });

  r.get("/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    return c.json(rRepo.listRecent(id, 10));
  });

  return r;
}
```

- [ ] **Step 5: Implement TOI API (placeholder until Task 11)**

Create `server/src/api/toi.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { toiSubmissionRepo } from "../db/repo/toi_submissions";
import { submitToToi } from "../toi/submit";

const SubmitZ = z.object({
  language: z.enum(["c", "cpp"]),
  code: z.string(),
});

export function toiRouter(db: Database, cfg: AppConfig) {
  const r = new Hono();
  const repo = toiSubmissionRepo(db);

  r.post("/:problemId/submit", async (c) => {
    const id = Number(c.req.param("problemId"));
    const body = SubmitZ.parse(await c.req.json());

    if (!cfg.toi.submitUrl || !cfg.toi.cookie) {
      return c.json({ error: "TOI not configured. Run the Chrome RE step first." }, 400);
    }

    const result = await submitToToi({
      submitUrl: cfg.toi.submitUrl,
      cookie: cfg.toi.cookie,
      extraHeaders: cfg.toi.extraHeaders,
      problemSlugId: String(id),
      language: body.language,
      code: body.code,
    });

    repo.create({
      problemId: id,
      language: body.language,
      codeSnapshot: body.code,
      httpStatus: result.status,
      responseJson: JSON.stringify(result.body ?? null),
      error: result.error,
    });

    return c.json(result);
  });

  return r;
}
```

- [ ] **Step 6: Add stub `submit.ts` for TOI**

Create `server/src/toi/submit.ts` (real implementation in Task 11):

```typescript
export interface ToiSubmitInput {
  submitUrl: string;
  cookie: string;
  extraHeaders: Record<string, string>;
  problemSlugId: string;
  language: "c" | "cpp";
  code: string;
}

export interface ToiSubmitResult {
  status: number | null;
  body: unknown;
  error: string | null;
}

export async function submitToToi(_input: ToiSubmitInput): Promise<ToiSubmitResult> {
  return { status: null, body: null, error: "submit-through not yet wired (Task 11 pending)" };
}
```

- [ ] **Step 7: Wire everything into `server/src/index.ts`**

Replace `server/src/index.ts`:

```typescript
import { Hono } from "hono";
import { openDb } from "./db/client";
import { loadConfig } from "./config";
import { problemsRouter } from "./api/problems";
import { solutionsRouter } from "./api/solutions";
import { runsRouter } from "./api/runs";
import { toiRouter } from "./api/toi";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const cfg = loadConfig();
mkdirSync(cfg.dataDir, { recursive: true });
mkdirSync(dirname(cfg.dbPath), { recursive: true });
const db = openDb(cfg.dbPath);

const app = new Hono();
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/problems", problemsRouter(db));
app.route("/api/solutions", solutionsRouter(db));
app.route("/api/runs", runsRouter(db, cfg));
app.route("/api/toi", toiRouter(db, cfg));

const port = cfg.apiPort;
console.log(`TOIZero API listening on http://localhost:${port}`);
export default { fetch: app.fetch, port };
```

- [ ] **Step 8: Create the local settings.json**

Run from project root: `cp settings.example.json settings.json` (PowerShell: `Copy-Item settings.example.json settings.json`).

- [ ] **Step 9: Manually smoke-test the API**

Run: `bun --cwd server dev`
In another shell:

```bash
curl -s http://localhost:8787/api/health
curl -s -X POST http://localhost:8787/api/problems -H "content-type: application/json" -d '{"slug":"addition","title":"Add Two Numbers","statementMd":"Add a and b.","sampleTests":[{"input":"1 2\n","expected":"3\n"}]}'
curl -s http://localhost:8787/api/problems
```

Expected: `{"ok":true}`, then `{"id":1}`, then a list containing the new problem.

- [ ] **Step 10: Commit**

```bash
git add server/src/api server/src/config.ts server/src/toi server/src/index.ts settings.json settings.example.json
git commit -m "feat(api): wire Hono routes for problems, solutions, runs, and TOI stub"
```

---

## Task 10: Frontend foundation — shell, nav, primitives

**Files:**
- Create: `web/src/lib/types.ts`
- Create: `web/src/lib/api.ts`
- Create: `web/src/components/NavPill.tsx`
- Create: `web/src/components/PillButton.tsx`
- Create: `web/src/components/EyebrowLabel.tsx`
- Create: `web/src/components/SatelliteCTA.tsx`
- Create: `web/src/components/ProblemCircle.tsx`
- Create: `web/src/components/OrbitalArc.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Shared types**

Create `web/src/lib/types.ts`:

```typescript
export type Language = "c" | "cpp";
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
  created_at: string;
  updated_at: string;
}

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
```

- [ ] **Step 2: Typed API client**

Create `web/src/lib/api.ts`:

```typescript
import type { Problem, ProblemDetail, JudgeResult, RunRow, Language } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const api = {
  listProblems: () => fetch("/api/problems").then(json<Problem[]>),
  getProblem: (id: number) => fetch(`/api/problems/${id}`).then(json<ProblemDetail>),
  createProblem: (body: unknown) =>
    fetch("/api/problems", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ id: number }>),
  updateProblem: (id: number, body: unknown) =>
    fetch(`/api/problems/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean }>),
  deleteProblem: (id: number) =>
    fetch(`/api/problems/${id}`, { method: "DELETE" }).then(json<{ ok: boolean }>),
  getSolution: (problemId: number) =>
    fetch(`/api/solutions/${problemId}`).then(json<{ id: number; language: Language; code: string } | null>),
  saveSolution: (problemId: number, language: Language, code: string) =>
    fetch(`/api/solutions/${problemId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code }) }).then(json<{ ok: boolean }>),
  runCode: (problemId: number, language: Language, code: string, scope: "sample" | "all") =>
    fetch(`/api/runs/${problemId}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code, scope }) }).then(json<JudgeResult>),
  listRuns: (problemId: number) => fetch(`/api/runs/${problemId}`).then(json<RunRow[]>),
  submitToToi: (problemId: number, language: Language, code: string) =>
    fetch(`/api/toi/${problemId}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code }) }).then(json<{ status: number | null; body: unknown; error: string | null }>),
};
```

- [ ] **Step 3: EyebrowLabel component**

Create `web/src/components/EyebrowLabel.tsx`:

```tsx
export function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-signal-light)]" />
      <span className="text-[14px] font-bold tracking-[0.04em] uppercase text-[var(--color-ink)]">
        {children}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: PillButton component**

Create `web/src/components/PillButton.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "consent";

const STYLES: Record<Variant, string> = {
  primary:   "bg-[var(--color-ink)] text-[var(--color-canvas)] border-[1.5px] border-[var(--color-ink)] rounded-[20px] px-6 py-1.5 font-medium tracking-[-0.02em]",
  secondary: "bg-white text-[var(--color-ink)] border-[1.5px] border-[var(--color-ink)] rounded-[20px] px-6 py-1.5 font-[450]",
  consent:   "bg-[var(--color-signal)] text-white rounded-[24px] px-7 py-1 text-[13px]",
};

export function PillButton(
  { variant = "primary", children, className = "", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }
) {
  return (
    <button className={`${STYLES[variant]} disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.98] ${className}`} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 5: SatelliteCTA component**

Create `web/src/components/SatelliteCTA.tsx`:

```tsx
export function SatelliteCTA({ onClick, label = "Open" }: { onClick?: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-14 h-14 rounded-full bg-white text-[var(--color-ink)] flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-transform"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 6: ProblemCircle component**

Create `web/src/components/ProblemCircle.tsx`:

```tsx
import { SatelliteCTA } from "./SatelliteCTA";
import { EyebrowLabel } from "./EyebrowLabel";

interface Props {
  title: string;
  category: string;
  status: "unsolved" | "attempted" | "solved";
  onOpen?: () => void;
  size?: number;
}

const STATUS_BG: Record<Props["status"], string> = {
  unsolved:  "bg-[var(--color-dust)]",
  attempted: "bg-[var(--color-signal-light)]/30",
  solved:    "bg-[var(--color-signal-light)]/60",
};

export function ProblemCircle({ title, category, status, onOpen, size = 280 }: Props) {
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <div className={`w-full h-full rounded-full ${STATUS_BG[status]} flex items-center justify-center`}>
          <span className="text-6xl text-[var(--color-ink)]/30 font-medium tracking-[-0.02em]">
            {title.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="absolute" style={{ bottom: -8, right: -8 }}>
          <SatelliteCTA onClick={onOpen} label={`Open ${title}`} />
        </div>
      </div>
      <div className="mt-6">
        <EyebrowLabel>{category}</EyebrowLabel>
      </div>
      <h3 className="mt-2 text-center text-[var(--color-ink)] line-clamp-2 px-4">{title}</h3>
    </div>
  );
}
```

- [ ] **Step 7: OrbitalArc component**

Create `web/src/components/OrbitalArc.tsx`:

```tsx
export function OrbitalArc({ width = 400, height = 80, className = "" }: { width?: number; height?: number; className?: string }) {
  // Soft hand-drawn arc, single-weight, in light signal orange
  const d = `M 0 ${height - 8} Q ${width / 2} -${height * 0.4} ${width} ${height - 8}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={d} stroke="var(--color-signal-light)" strokeWidth="1.25" fill="none" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 8: NavPill component**

Create `web/src/components/NavPill.tsx`:

```tsx
import { Link, useLocation } from "react-router-dom";

export function NavPill() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40">
      <nav className="bg-white rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex items-center gap-12 px-10 py-3">
        <Link to="/" className="flex items-center gap-1.5" aria-label="TOIZero home">
          <span className="w-4 h-4 rounded-full bg-[var(--color-mc-red)] -mr-1.5" />
          <span className="w-4 h-4 rounded-full bg-[var(--color-mc-yellow)] mix-blend-multiply" />
          <span className="ml-2 font-medium tracking-[-0.02em]">TOIZero</span>
        </Link>
        <div className="flex items-center gap-12">
          <Link to="/" className={`text-[16px] font-medium tracking-[-0.03em] ${onHome ? "text-[var(--color-ink)]" : "text-[var(--color-graphite)]"}`}>
            Problems
          </Link>
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 9: Wire App.tsx with router shell**

Replace `web/src/App.tsx`:

```tsx
import { Routes, Route } from "react-router-dom";
import { NavPill } from "./components/NavPill";

function Placeholder({ title }: { title: string }) {
  return <div className="pt-32 px-12"><h1>{title}</h1><p className="mt-6 max-w-prose">Stub — wiring in next task.</p></div>;
}

export default function App() {
  return (
    <div className="min-h-screen pb-24">
      <NavPill />
      <Routes>
        <Route path="/" element={<Placeholder title="Problems" />} />
        <Route path="/p/:id" element={<Placeholder title="Problem Workspace" />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 10: Verify in browser**

Run: `bun run dev:server` and `bun run dev:web` in two shells. Open `http://localhost:5173`. Confirm:
- Floating white pill nav at the top, centered, with Mastercard red+yellow circles + "TOIZero" wordmark + "Problems" link.
- Background remains warm cream.
- Page content reads "Problems" as a big headline.

- [ ] **Step 11: Commit**

```bash
git add web/src/lib web/src/components web/src/App.tsx
git commit -m "feat(web): add Mastercard nav pill, primitives, and router shell"
```

---

## Task 11: Problem list page

**Files:**
- Create: `web/src/pages/ProblemListPage.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Implement ProblemListPage**

Create `web/src/pages/ProblemListPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Problem } from "../lib/types";
import { ProblemCircle } from "../components/ProblemCircle";
import { PillButton } from "../components/PillButton";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { OrbitalArc } from "../components/OrbitalArc";

export function ProblemListPage({ onAdd }: { onAdd: () => void }) {
  const [problems, setProblems] = useState<Problem[] | null>(null);

  useEffect(() => {
    api.listProblems().then(setProblems);
  }, []);

  return (
    <div className="pt-32 px-12 max-w-[1280px] mx-auto">
      <div className="mb-4"><EyebrowLabel>Library</EyebrowLabel></div>
      <div className="flex items-end justify-between mb-16">
        <h1 className="max-w-3xl">Problems for your TOI Zero prep.</h1>
        <PillButton onClick={onAdd}>Add problem</PillButton>
      </div>

      {problems === null && <p className="text-[var(--color-slate)]">Loading…</p>}
      {problems !== null && problems.length === 0 && (
        <div className="rounded-[40px] bg-[var(--color-lifted)] p-16 text-center">
          <EyebrowLabel>Empty</EyebrowLabel>
          <h2 className="mt-4 mb-2">No problems yet.</h2>
          <p className="text-[var(--color-slate)] mb-8">Paste your first one from TOI to get started.</p>
          <PillButton onClick={onAdd}>Add your first problem</PillButton>
        </div>
      )}

      {problems !== null && problems.length > 0 && (
        <div className="relative">
          <div className="absolute -top-8 left-12 opacity-50 pointer-events-none">
            <OrbitalArc width={520} height={120} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-24 gap-x-12 pt-12">
            {problems.map((p, i) => (
              <div key={p.id} className={i % 2 === 0 ? "md:translate-y-12" : ""}>
                <Link to={`/p/${p.id}`}>
                  <ProblemCircle title={p.title} category={p.category} status="unsolved" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire route + add-button state in App.tsx**

Replace `web/src/App.tsx`:

```tsx
import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { NavPill } from "./components/NavPill";
import { ProblemListPage } from "./pages/ProblemListPage";

function WorkspacePlaceholder() {
  return <div className="pt-32 px-12"><h1>Workspace</h1></div>;
}

export default function App() {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="min-h-screen pb-24">
      <NavPill />
      <Routes>
        <Route path="/" element={<ProblemListPage onAdd={() => setShowAdd(true)} />} />
        <Route path="/p/:id" element={<WorkspacePlaceholder />} />
      </Routes>
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-[40px] p-12 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4">Add problem</h2>
            <p className="text-[var(--color-slate)]">Form coming in Task 12.</p>
            <div className="mt-8 flex gap-3 justify-end">
              <button onClick={() => setShowAdd(false)} className="text-[var(--color-slate)]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:5173`. Expected:
- "Library" eyebrow + "Problems for your TOI Zero prep." headline.
- Empty state pill with "Add your first problem" CTA (because DB is empty after the smoke-test in Task 9 added one problem — you should see ONE circle if you didn't delete it).
- Clicking "Add problem" shows a placeholder modal.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/ProblemListPage.tsx web/src/App.tsx
git commit -m "feat(web): add problem list page with Mastercard constellation layout"
```

---

## Task 12: Add/Edit problem modal

**Files:**
- Create: `web/src/pages/ProblemEditModal.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Implement ProblemEditModal**

Create `web/src/pages/ProblemEditModal.tsx`:

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ProblemDetail } from "../lib/types";
import { PillButton } from "../components/PillButton";
import { EyebrowLabel } from "../components/EyebrowLabel";

interface SampleDraft { input: string; expected: string; explanationMd: string; }
interface ExtraDraft  { input: string; expected: string; subtask: string; }

interface Props {
  editingId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProblemEditModal({ editingId, onClose, onSaved }: Props) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [inputFmt, setInputFmt] = useState("");
  const [outputFmt, setOutputFmt] = useState("");
  const [category, setCategory] = useState("general");
  const [timeLimitMs, setTimeLimitMs] = useState(1000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [ioMode, setIoMode] = useState("stdio");
  const [sourceUrl, setSourceUrl] = useState("");
  const [samples, setSamples] = useState<SampleDraft[]>([{ input: "", expected: "", explanationMd: "" }]);
  const [extras, setExtras] = useState<ExtraDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editingId === null) return;
    api.getProblem(editingId).then((p: ProblemDetail) => {
      setSlug(p.slug); setTitle(p.title);
      setStatement(p.statement_md); setInputFmt(p.input_md); setOutputFmt(p.output_md);
      setCategory(p.category); setTimeLimitMs(p.time_limit_ms); setMemoryLimitMb(p.memory_limit_mb);
      setIoMode(p.io_mode); setSourceUrl(p.source_url);
      setSamples(p.tests.samples.map((t) => ({ input: t.input_text, expected: t.expected_text, explanationMd: t.explanation_md })));
      setExtras(p.tests.extras.map((t) => ({ input: t.input_text, expected: t.expected_text, subtask: t.subtask })));
    });
  }, [editingId]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const body = {
        slug, title, statementMd: statement, inputMd: inputFmt, outputMd: outputFmt,
        category, timeLimitMs, memoryLimitMb, ioMode, sourceUrl,
        sampleTests: samples, extraTests: extras,
      };
      if (editingId === null) await api.createProblem(body);
      else await api.updateProblem(editingId, body);
      onSaved();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  function updateSample(i: number, patch: Partial<SampleDraft>) {
    setSamples(samples.map((s, j) => j === i ? { ...s, ...patch } : s));
  }
  function updateExtra(i: number, patch: Partial<ExtraDraft>) {
    setExtras(extras.map((s, j) => j === i ? { ...s, ...patch } : s));
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block">
      <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-1.5">{label}</div>
      {children}
    </label>
  );

  const inputCls = "w-full rounded-2xl border border-[var(--color-dust)] bg-white px-4 py-2 focus:outline-none focus:border-[var(--color-ink)]";
  const areaCls = inputCls + " font-mono text-[13px]";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center overflow-auto py-12" onClick={onClose}>
      <div className="bg-white rounded-[40px] p-10 max-w-3xl w-full mx-6 my-12" onClick={(e) => e.stopPropagation()}>
        <EyebrowLabel>{editingId === null ? "New" : "Edit"}</EyebrowLabel>
        <h2 className="mt-3 mb-8">{editingId === null ? "Add problem" : "Edit problem"}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field label="Slug"><input className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="addition" /></Field>
          <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add Two Numbers" /></Field>
          <Field label="Category"><input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
          <Field label="Source URL"><input className={inputCls} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://toi-coding…" /></Field>
          <Field label="Time limit (ms)"><input type="number" className={inputCls} value={timeLimitMs} onChange={(e) => setTimeLimitMs(Number(e.target.value))} /></Field>
          <Field label="Memory limit (MB)"><input type="number" className={inputCls} value={memoryLimitMb} onChange={(e) => setMemoryLimitMb(Number(e.target.value))} /></Field>
          <Field label="I/O mode"><input className={inputCls} value={ioMode} onChange={(e) => setIoMode(e.target.value)} placeholder="stdio or file:train1" /></Field>
        </div>

        <Field label="Statement (Markdown)"><textarea className={areaCls + " min-h-[120px]"} value={statement} onChange={(e) => setStatement(e.target.value)} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Input format"><textarea className={areaCls + " min-h-[80px]"} value={inputFmt} onChange={(e) => setInputFmt(e.target.value)} /></Field>
          <Field label="Output format"><textarea className={areaCls + " min-h-[80px]"} value={outputFmt} onChange={(e) => setOutputFmt(e.target.value)} /></Field>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <EyebrowLabel>Sample tests</EyebrowLabel>
            <button className="text-[var(--color-link)] text-sm" onClick={() => setSamples([...samples, { input: "", expected: "", explanationMd: "" }])}>+ add sample</button>
          </div>
          {samples.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 mb-3">
              <textarea placeholder="Input"    className={areaCls + " min-h-[80px]"} value={s.input}    onChange={(e) => updateSample(i, { input: e.target.value })} />
              <textarea placeholder="Expected" className={areaCls + " min-h-[80px]"} value={s.expected} onChange={(e) => updateSample(i, { expected: e.target.value })} />
              <div className="col-span-2 flex justify-end">
                <button className="text-[var(--color-slate)] text-sm" onClick={() => setSamples(samples.filter((_, j) => j !== i))}>remove</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <EyebrowLabel>Extra tests (optional, with subtask)</EyebrowLabel>
            <button className="text-[var(--color-link)] text-sm" onClick={() => setExtras([...extras, { input: "", expected: "", subtask: "main" }])}>+ add extra</button>
          </div>
          {extras.map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 mb-3">
              <input className={inputCls} placeholder="subtask name (e.g. subtask1)" value={s.subtask} onChange={(e) => updateExtra(i, { subtask: e.target.value })} />
              <textarea placeholder="Input"    className={areaCls + " min-h-[60px]"} value={s.input}    onChange={(e) => updateExtra(i, { input: e.target.value })} />
              <textarea placeholder="Expected" className={areaCls + " min-h-[60px]"} value={s.expected} onChange={(e) => updateExtra(i, { expected: e.target.value })} />
              <div className="col-span-3 flex justify-end">
                <button className="text-[var(--color-slate)] text-sm" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>remove</button>
              </div>
            </div>
          ))}
        </div>

        {err && <div className="mt-6 text-[var(--color-signal)] text-sm">{err}</div>}

        <div className="mt-10 flex gap-3 justify-end">
          <button onClick={onClose} className="text-[var(--color-slate)] px-4">Cancel</button>
          <PillButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</PillButton>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Hook modal into App.tsx**

Replace the relevant parts of `web/src/App.tsx` to use the real modal:

```tsx
import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { NavPill } from "./components/NavPill";
import { ProblemListPage } from "./pages/ProblemListPage";
import { ProblemEditModal } from "./pages/ProblemEditModal";

function WorkspacePlaceholder() {
  return <div className="pt-32 px-12"><h1>Workspace</h1></div>;
}

export default function App() {
  const [editing, setEditing] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen pb-24">
      <NavPill />
      <Routes>
        <Route
          path="/"
          element={<ProblemListPage key={refreshKey} onAdd={() => setEditing({ open: true, id: null })} />}
        />
        <Route path="/p/:id" element={<WorkspacePlaceholder />} />
      </Routes>
      {editing.open && (
        <ProblemEditModal
          editingId={editing.id}
          onClose={() => setEditing({ open: false, id: null })}
          onSaved={() => { setEditing({ open: false, id: null }); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke test**

Click "Add problem", fill in a real problem from TOI (paste statement, two samples), click Save. Confirm the list refreshes and the new circle appears.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/ProblemEditModal.tsx web/src/App.tsx
git commit -m "feat(web): add/edit problem modal with samples and subtask extras"
```

---

## Task 13: Problem workspace — Monaco editor + statement panel

**Files:**
- Create: `web/src/components/CodeEditor.tsx`
- Create: `web/src/components/MarkdownRender.tsx`
- Create: `web/src/pages/ProblemWorkspacePage.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Implement CodeEditor**

Create `web/src/components/CodeEditor.tsx`:

```tsx
import Editor from "@monaco-editor/react";
import type { Language } from "../lib/types";

const STARTERS: Record<Language, string> = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n`,
  c:   `#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n`,
};

export function starterFor(lang: Language) { return STARTERS[lang]; }

export function CodeEditor({ language, value, onChange }: { language: Language; value: string; onChange: (v: string) => void }) {
  return (
    <Editor
      height="100%"
      language={language === "cpp" ? "cpp" : "c"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme="vs-light"
      options={{
        fontFamily: "JetBrains Mono, Consolas, monospace",
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        insertSpaces: true,
        wordWrap: "on",
      }}
    />
  );
}
```

- [ ] **Step 2: Implement MarkdownRender**

Create `web/src/components/MarkdownRender.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRender({ children }: { children: string }) {
  return (
    <div className="prose prose-stone max-w-none text-[var(--color-ink)] [&_pre]:bg-[var(--color-bone)] [&_pre]:rounded-2xl [&_pre]:p-4 [&_code]:font-mono [&_code]:text-[13px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 3: Implement ProblemWorkspacePage (statement + editor only — Run wired in Task 14)**

Create `web/src/pages/ProblemWorkspacePage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import type { ProblemDetail, Language } from "../lib/types";
import { CodeEditor, starterFor } from "../components/CodeEditor";
import { MarkdownRender } from "../components/MarkdownRender";
import { PillButton } from "../components/PillButton";
import { EyebrowLabel } from "../components/EyebrowLabel";

export function ProblemWorkspacePage() {
  const { id } = useParams();
  const pid = Number(id);
  const [p, setP] = useState<ProblemDetail | null>(null);
  const [lang, setLang] = useState<Language>("cpp");
  const [code, setCode] = useState<string>("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getProblem(pid).then(setP);
    api.getSolution(pid).then((s) => {
      if (s) { setLang(s.language); setCode(s.code); }
      else { setCode(starterFor("cpp")); }
    });
  }, [pid]);

  async function save() {
    await api.saveSolution(pid, lang, code);
    setSavedMsg("Saved"); setTimeout(() => setSavedMsg(null), 1500);
  }

  if (!p) return <div className="pt-32 px-12">Loading…</div>;

  return (
    <div className="pt-28 px-6 max-w-[1600px] mx-auto">
      <div className="mb-2"><Link to="/" className="text-[var(--color-link)] text-sm">← Problems</Link></div>
      <EyebrowLabel>{p.category}</EyebrowLabel>
      <h1 className="mt-2 mb-8">{p.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-[40px] p-10 max-h-[80vh] overflow-y-auto">
          <MarkdownRender>{p.statement_md || "_No statement yet._"}</MarkdownRender>
          {p.input_md && (<><h3 className="mt-8 mb-2">Input</h3><MarkdownRender>{p.input_md}</MarkdownRender></>)}
          {p.output_md && (<><h3 className="mt-8 mb-2">Output</h3><MarkdownRender>{p.output_md}</MarkdownRender></>)}
          <h3 className="mt-8 mb-2">Samples</h3>
          {p.tests.samples.map((t, i) => (
            <div key={t.id} className="mb-6">
              <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-2">Sample {i + 1}</div>
              <div className="grid grid-cols-2 gap-3">
                <pre className="bg-[var(--color-bone)] rounded-2xl p-4 text-[12px] whitespace-pre-wrap">{t.input_text}</pre>
                <pre className="bg-[var(--color-bone)] rounded-2xl p-4 text-[12px] whitespace-pre-wrap">{t.expected_text}</pre>
              </div>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-[40px] p-4 flex flex-col" style={{ height: "80vh" }}>
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <select value={lang} onChange={(e) => setLang(e.target.value as Language)} className="rounded-full border border-[var(--color-dust)] px-4 py-1 text-sm">
                <option value="cpp">C++</option>
                <option value="c">C</option>
              </select>
              {savedMsg && <span className="text-sm text-[var(--color-slate)]">{savedMsg}</span>}
            </div>
            <div className="flex gap-2">
              <PillButton variant="secondary" onClick={save}>Save</PillButton>
            </div>
          </div>
          <div className="flex-1 overflow-hidden rounded-[24px] border border-[var(--color-dust)]/40">
            <CodeEditor language={lang} value={code} onChange={setCode} />
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire route in App.tsx**

Replace the workspace placeholder in `web/src/App.tsx`:

```tsx
import { ProblemWorkspacePage } from "./pages/ProblemWorkspacePage";
// …
<Route path="/p/:id" element={<ProblemWorkspacePage />} />
```

- [ ] **Step 5: Manual smoke test**

Click a problem circle. Confirm:
- Statement renders left, editor renders right, both inside cream-on-white rounded-40 cards.
- Lang dropdown switches between C++ and C; Save button persists.
- Refreshing the page restores your code (from `solution` table).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/CodeEditor.tsx web/src/components/MarkdownRender.tsx web/src/pages/ProblemWorkspacePage.tsx web/src/App.tsx
git commit -m "feat(web): add Monaco editor + statement panel workspace"
```

---

## Task 14: Workspace — Run + test results panel + run history

**Files:**
- Create: `web/src/components/TestResultsPanel.tsx`
- Create: `web/src/components/RunHistoryList.tsx`
- Modify: `web/src/pages/ProblemWorkspacePage.tsx`

- [ ] **Step 1: Implement TestResultsPanel**

Create `web/src/components/TestResultsPanel.tsx`:

```tsx
import type { JudgeResult, Verdict } from "../lib/types";

const COLOR: Record<Verdict, string> = {
  AC: "var(--color-signal-light)",
  WA: "var(--color-signal)",
  TLE: "var(--color-clay)",
  RE: "var(--color-clay)",
  CE: "var(--color-graphite)",
};

export function TestResultsPanel({ result }: { result: JudgeResult }) {
  return (
    <div className="bg-[var(--color-lifted)] rounded-[24px] p-6 mt-4 max-h-[40vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ background: COLOR[result.verdict] }} />
          <span className="font-medium text-lg tracking-[-0.02em]">{result.verdict}</span>
          <span className="text-[var(--color-slate)] text-sm">{result.totalRuntimeMs}ms total</span>
        </div>
      </div>

      {result.compileStderr && (
        <pre className="bg-white rounded-2xl p-4 text-[12px] whitespace-pre-wrap text-[var(--color-signal)]">{result.compileStderr}</pre>
      )}

      {result.subtaskScores && Object.keys(result.subtaskScores).length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(result.subtaskScores).map(([k, v]) => (
            <span key={k} className="rounded-full bg-white px-3 py-1 text-sm">
              {k}: {v.passed}/{v.total}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {result.perTest.map((t) => (
          <div key={t.idx} className="bg-white rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: COLOR[t.verdict] }} />
                <span className="font-medium">Test {t.idx + 1}</span>
                <span className="text-[var(--color-slate)] text-xs">{t.subtask}</span>
              </div>
              <div className="text-sm text-[var(--color-slate)]">{t.verdict} · {t.runtimeMs}ms</div>
            </div>
            {t.diff && (
              <pre className="mt-2 bg-[var(--color-bone)] rounded-xl p-2 text-[11px] whitespace-pre-wrap">{t.diff}</pre>
            )}
            {t.stderr && (
              <pre className="mt-2 bg-[var(--color-bone)] rounded-xl p-2 text-[11px] whitespace-pre-wrap text-[var(--color-clay)]">{t.stderr}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement RunHistoryList**

Create `web/src/components/RunHistoryList.tsx`:

```tsx
import type { RunRow } from "../lib/types";

export function RunHistoryList({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) return <div className="text-[var(--color-slate)] text-sm px-4 py-2">No runs yet.</div>;
  return (
    <ul className="space-y-1 px-2">
      {runs.map((r) => (
        <li key={r.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--color-lifted)]">
          <span className="font-medium">{r.verdict}</span>
          <span className="text-xs text-[var(--color-slate)]">{r.total_runtime_ms}ms · {new Date(r.created_at).toLocaleTimeString()}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Wire Run + history into the workspace**

Replace `web/src/pages/ProblemWorkspacePage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import type { ProblemDetail, Language, JudgeResult, RunRow } from "../lib/types";
import { CodeEditor, starterFor } from "../components/CodeEditor";
import { MarkdownRender } from "../components/MarkdownRender";
import { PillButton } from "../components/PillButton";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { TestResultsPanel } from "../components/TestResultsPanel";
import { RunHistoryList } from "../components/RunHistoryList";

export function ProblemWorkspacePage() {
  const { id } = useParams();
  const pid = Number(id);
  const [p, setP] = useState<ProblemDetail | null>(null);
  const [lang, setLang] = useState<Language>("cpp");
  const [code, setCode] = useState<string>("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getProblem(pid).then(setP);
    api.getSolution(pid).then((s) => {
      if (s) { setLang(s.language); setCode(s.code); }
      else setCode(starterFor("cpp"));
    });
    api.listRuns(pid).then(setRuns);
  }, [pid]);

  async function save() {
    await api.saveSolution(pid, lang, code);
    setSavedMsg("Saved"); setTimeout(() => setSavedMsg(null), 1500);
  }
  async function run(scope: "sample" | "all") {
    setRunning(true);
    await save();
    try {
      const r = await api.runCode(pid, lang, code, scope);
      setResult(r);
      setRuns(await api.listRuns(pid));
    } finally { setRunning(false); }
  }
  async function submitToToi() {
    if (!confirm("Submit this code to the official TOI grader? This sends a real submission.")) return;
    setSubmitting(true); setSubmitMsg(null);
    try {
      const r = await api.submitToToi(pid, lang, code);
      if (r.error) setSubmitMsg("TOI error: " + r.error);
      else setSubmitMsg("Submitted to TOI (HTTP " + r.status + "). Check the TOI site for the verdict.");
    } catch (e: any) { setSubmitMsg("Submit failed: " + (e.message ?? String(e))); }
    finally { setSubmitting(false); }
  }

  if (!p) return <div className="pt-32 px-12">Loading…</div>;

  return (
    <div className="pt-28 px-6 max-w-[1600px] mx-auto">
      <div className="mb-2"><Link to="/" className="text-[var(--color-link)] text-sm">← Problems</Link></div>
      <EyebrowLabel>{p.category}</EyebrowLabel>
      <h1 className="mt-2 mb-8">{p.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-[40px] p-10 max-h-[80vh] overflow-y-auto">
          <MarkdownRender>{p.statement_md || "_No statement yet._"}</MarkdownRender>
          {p.input_md && (<><h3 className="mt-8 mb-2">Input</h3><MarkdownRender>{p.input_md}</MarkdownRender></>)}
          {p.output_md && (<><h3 className="mt-8 mb-2">Output</h3><MarkdownRender>{p.output_md}</MarkdownRender></>)}
          <h3 className="mt-8 mb-2">Samples</h3>
          {p.tests.samples.map((t, i) => (
            <div key={t.id} className="mb-6">
              <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-2">Sample {i + 1}</div>
              <div className="grid grid-cols-2 gap-3">
                <pre className="bg-[var(--color-bone)] rounded-2xl p-4 text-[12px] whitespace-pre-wrap">{t.input_text}</pre>
                <pre className="bg-[var(--color-bone)] rounded-2xl p-4 text-[12px] whitespace-pre-wrap">{t.expected_text}</pre>
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-col" style={{ height: "80vh" }}>
          <div className="bg-white rounded-[40px] p-4 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <select value={lang} onChange={(e) => setLang(e.target.value as Language)} className="rounded-full border border-[var(--color-dust)] px-4 py-1 text-sm">
                  <option value="cpp">C++</option>
                  <option value="c">C</option>
                </select>
                {savedMsg && <span className="text-sm text-[var(--color-slate)]">{savedMsg}</span>}
              </div>
              <div className="flex gap-2">
                <PillButton variant="secondary" onClick={save}>Save</PillButton>
                <PillButton onClick={() => run("sample")} disabled={running}>{running ? "Running…" : "Run samples"}</PillButton>
                <PillButton variant="secondary" onClick={() => run("all")} disabled={running}>Run all</PillButton>
                <PillButton onClick={submitToToi} disabled={submitting}>{submitting ? "Submitting…" : "Submit to TOI"}</PillButton>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-[24px] border border-[var(--color-dust)]/40 min-h-0">
              <CodeEditor language={lang} value={code} onChange={setCode} />
            </div>
            {submitMsg && <div className="px-4 pt-3 text-sm text-[var(--color-slate)]">{submitMsg}</div>}
            {result && <TestResultsPanel result={result} />}
          </div>
        </section>
      </div>

      <section className="mt-12">
        <EyebrowLabel>Recent runs</EyebrowLabel>
        <div className="mt-3 bg-white rounded-[40px] p-4">
          <RunHistoryList runs={runs} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Manual happy-path verification**

1. Open a problem you added.
2. Paste a known-correct C++ solution.
3. Click "Run samples" → expect `AC` panel with green dots per sample.
4. Edit one line to make it wrong → "Run samples" → expect `WA` with a diff.
5. Inject `while (1) {}` → expect `TLE`.
6. Delete a closing brace → expect `CE` with compile stderr.
7. Confirm "Recent runs" shows each attempt.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TestResultsPanel.tsx web/src/components/RunHistoryList.tsx web/src/pages/ProblemWorkspacePage.tsx
git commit -m "feat(web): wire Run, results panel, run history"
```

---

## Task 15: TOI submit-through — Chrome RE session (interactive)

> **This task is interactive and uses the Claude in Chrome extension. It is the ONLY task that can't be executed headlessly. Pause here and run it with the user driving.**

**Files:**
- Modify: `settings.json` (paste TOI submit URL, cookie, extra headers)
- Modify: `server/src/toi/submit.ts` (real implementation)

- [ ] **Step 1: Open the TOI site in the user's browser**

Using `mcp__Claude_in_Chrome__tabs_context_mcp` then `mcp__Claude_in_Chrome__navigate` to `https://toi-coding.informatics.buu.ac.th/00-pre-toi`. Confirm the user is logged in. If not, ask them to log in manually — do NOT enter credentials.

- [ ] **Step 2: Navigate to one problem the user has already imported into TOIZero**

Have the user choose any problem on TOI that they've also pasted into TOIZero. Navigate to that problem's submission page.

- [ ] **Step 3: Capture network shape during a real submission**

Tell the user: "Paste any solution and click Submit on the TOI page. I'll capture the network request shape."

Immediately after they click submit, run `mcp__Claude_in_Chrome__read_network_requests` with `urlPattern` filtered to the TOI host. Identify the POST request that carries the source code:

- Note the URL
- Note the method (POST)
- Note request headers — specifically `Cookie` value, `Content-Type`, any `X-CSRF-Token` / `X-Requested-With`
- Note request body shape — is it JSON? `multipart/form-data`? form-urlencoded? Which fields carry the code, language, problem id?

- [ ] **Step 4: Write the findings to settings.json**

Update `settings.json`:

```json
"toi": {
  "submitUrl": "<paste captured URL>",
  "cookie": "<paste captured Cookie header value verbatim>",
  "extraHeaders": {
    "X-Requested-With": "<if present>",
    "X-CSRF-Token": "<if present>"
  },
  "bodyShape": "json | form | multipart",
  "fields": {
    "code":       "<name of the field that holds the source>",
    "language":   "<name of the language field>",
    "problemId":  "<name of the problem id field>",
    "languageMap": { "cpp": "<TOI's value for C++>", "c": "<TOI's value for C>" }
  }
}
```

(Extend the `AppConfig` type in `server/src/config.ts` to include `bodyShape` and `fields`. Update `settings.example.json` to document the same fields with empty/placeholder values.)

- [ ] **Step 5: Replace the submit stub with a real implementation**

Replace `server/src/toi/submit.ts`:

```typescript
export interface ToiSubmitInput {
  submitUrl: string;
  cookie: string;
  extraHeaders: Record<string, string>;
  problemSlugId: string;
  language: "c" | "cpp";
  code: string;
  bodyShape: "json" | "form" | "multipart";
  fields: {
    code: string;
    language: string;
    problemId: string;
    languageMap: Record<"c" | "cpp", string>;
  };
}

export interface ToiSubmitResult {
  status: number | null;
  body: unknown;
  error: string | null;
}

export async function submitToToi(input: ToiSubmitInput): Promise<ToiSubmitResult> {
  const headers: Record<string, string> = {
    Cookie: input.cookie,
    ...input.extraHeaders,
  };

  let body: BodyInit;
  if (input.bodyShape === "json") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      [input.fields.code]: input.code,
      [input.fields.language]: input.fields.languageMap[input.language],
      [input.fields.problemId]: input.problemSlugId,
    });
  } else if (input.bodyShape === "form") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const f = new URLSearchParams();
    f.set(input.fields.code, input.code);
    f.set(input.fields.language, input.fields.languageMap[input.language]);
    f.set(input.fields.problemId, input.problemSlugId);
    body = f.toString();
  } else {
    const f = new FormData();
    f.set(input.fields.code, input.code);
    f.set(input.fields.language, input.fields.languageMap[input.language]);
    f.set(input.fields.problemId, input.problemSlugId);
    body = f;
    // multipart: let fetch set the Content-Type with boundary
  }

  try {
    const res = await fetch(input.submitUrl, { method: "POST", headers, body });
    let parsed: unknown = null;
    const text = await res.text();
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 4000); }
    return { status: res.status, body: parsed, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e: any) {
    return { status: null, body: null, error: e.message ?? String(e) };
  }
}
```

Also update `server/src/api/toi.ts` to pass the new fields through (`bodyShape`, `fields`).

- [ ] **Step 6: Test ONE real submission, end-to-end**

In the app, open the same problem, click "Submit to TOI", confirm the prompt. Expected: green message "Submitted to TOI (HTTP 200…)". Verify in the user's browser tab that the submission appears in TOI's submission list with the timestamp matching now.

If it fails: the most common causes (in order) are stale cookie, missing CSRF header, or wrong language map value. Re-capture network shape and re-try.

- [ ] **Step 7: Commit**

```bash
git add server/src/toi/submit.ts server/src/api/toi.ts server/src/config.ts settings.example.json
git commit -m "feat(toi): wire reverse-engineered submit-through to TOI grader"
```

(Note: `settings.json` is gitignored — your cookie is NOT committed.)

---

## Task 16: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full happy path**

Restart everything cleanly:
- `bun --cwd server start` (production mode, no watch)
- `bun --cwd web build && bun --cwd web preview`

Open the preview URL. Walk through:
1. Add a TOI problem from scratch via the modal (paste statement + 2 samples).
2. Open it.
3. Write a correct C++ solution.
4. Save, Run samples → AC.
5. Run all → AC.
6. Click "Submit to TOI" → green message.
7. Refresh — confirm code, runs, and (in the DB) TOI submission row persist.

- [ ] **Step 2: Verify design fidelity against `info/DESIGN.md`**

Open the running app side-by-side with the DESIGN.md "Do" and "Don't" lists. Spot-check:
- [ ] Background is Canvas Cream `#F3F0EE`, not white.
- [ ] Primary buttons are Ink Black pills with 20px radius and cream (not white) text.
- [ ] Headlines use weight 500 + tight -2% letter-spacing.
- [ ] Body text uses weight 450.
- [ ] Eyebrow labels have the tiny orange dot prefix.
- [ ] Nav is a floating white pill below the viewport top, not flush.
- [ ] Problem circles are perfect circles with white satellite CTAs docked at bottom-right.
- [ ] Sections use 40px radius, never 8–16px.
- [ ] Signal Orange (`#CF4500`) appears only on consent-style affordances and the verdict dot, not as a marketing CTA.

For each item that fails, file a fix in the same task; the goal is to land Task 16 with all checkboxes green.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verified end-to-end TOIZero happy path against design spec"
```

---

## Self-Review Summary

**Spec coverage check:**
- Manual paste-in for problems → Task 12 (modal) ✓
- C/C++ only → enforced in Zod schemas and language types ✓
- Local judge (option A) → Tasks 4–8 ✓
- TOI submit-through (option C) → Task 15 ✓
- Mastercard design — Tasks 2, 10–14 reference `info/DESIGN.md` throughout ✓
- 4 essential pages — Problem list (11), workspace (13–14), add/edit modal (12), run history (14) ✓
- File I/O mode → Task 8 ✓
- Markdown statements → Task 13 ✓
- Subtask scoring → schema (Task 3) + judge orchestrator (Task 7) + UI (Task 14) ✓
- Compiler flags `-O2 -std=c++17 -Wall -Wextra -static` → Task 4 (DEFAULTS) ✓
- Verdicts AC/WA/TLE/RE/CE → Task 4 onward; MLE explicitly deferred ✓

**Placeholders:** none — every step contains actual code or actual commands with expected output.

**Type consistency:** `Verdict` type defined in `server/src/judge/verdicts.ts` and re-used everywhere; `Language = "c" | "cpp"` consistent across server + web; `CreateProblemInput` field names match the Zod schema in `problems.ts` (Task 9) and the modal payload in Task 12.

**Known sequencing concern:** Task 15 (Chrome RE) is the only task that needs the user's hands at runtime. Tasks 1–14 can be executed by an agent or by hand without interaction. Task 16 is verification.
