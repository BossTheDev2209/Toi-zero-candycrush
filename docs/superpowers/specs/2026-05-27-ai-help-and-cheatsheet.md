# AI Help, Per-Language Cheat Sheets, Ctrl+K Palette — Design Spec

**Status:** Approved
**Date:** 2026-05-27
**Register:** product (single-user app)
**Design source of truth:** [info/DESIGN.md](../../../info/DESIGN.md) (Mastercard system)

---

## 1. Goal

Three coordinated additions to TOIZero:

1. **AI Help** — a slide-out chat panel on the problem workspace that takes the user's question, the problem statement, the user's current code, and the latest run result, then asks an AI provider for a Socratic hint. Multi-provider (Anthropic / OpenAI / Ollama). Persists per problem.
2. **Cheat Sheets** — curated, hand-written markdown reference per language (C, C++, Python) covering I/O, control flow, data structures, STL/stdlib idioms, and common olympiad tricks. Rendered as a polished doc page with copy-buttons and sticky TOC.
3. **Ctrl+K Command Palette** — a single keyboard-driven search bar that finds problems, cheat sheet entries, and docs sections in one flat list. Enter navigates.

These three together close TOIZero's loop from "running code" to "learning when stuck."

---

## 2. UX principles

| Principle | Why |
|---|---|
| **Spoiler guard on by default.** The AI is system-prompted to give hints + Socratic questions, never the full solution unless the user explicitly says "just show me" via a button. | Preserves the learning. Olympiad prep is muscle-building, not copy-paste. |
| **AI has full context.** Statement, code, language, latest verdict, diff, stderr. | Targeted hints, not generic platitudes. |
| **Provider is user choice.** Dropdown in Settings with three options. | User has subscription not API — needs free-Ollama path. |
| **Chat persists per problem.** Conversation lives in DB keyed by `problem_id`. | Returning a week later, the thread is still there. |
| **Cheat sheets are local files.** No CDN, no API. Instant load, offline-safe. | Cheat sheet defeats its purpose if it's slow. |
| **Cheat sheet content is hand-curated, not AI-generated.** | Consistency, brevity, no hallucinations on syntax. |
| **One palette to rule them all.** Ctrl+K opens a single fuzzy-search across problems, cheat sheet entries, and docs sections. | Two palettes is two muscle memories. One scales. |
| **No streaming-tokens UI gymnastics.** Backend buffers the AI response and returns it whole. | Single-user app; streaming complexity isn't worth the polish. |
| **Costs stay visible.** Provider responses include token usage; chat panel shows a small "~N tokens" hint. | Honesty about what you're spending. |
| **No API key leaves the machine.** Keys stored in `settings.json` (gitignored). Backend reads at request time. Never echoed to logs or chat panel. | Security hygiene. |

---

## 3. AI Help

### 3.1 Providers

Three options, all behind one server-side abstraction. User picks via Settings dropdown.

| Provider | Key field in `settings.json` | Default model | Notes |
|---|---|---|---|
| `anthropic` | `ai.anthropicApiKey` | `claude-sonnet-4-5` | Streaming supported but we use non-streaming. Strong at Socratic tutoring. |
| `openai` | `ai.openaiApiKey` | `gpt-4o-mini` | Cheap, fast. |
| `ollama` | `ai.ollamaUrl` (default `http://localhost:11434`) | `qwen2.5-coder:7b` | No key needed. Requires Ollama running locally with the model pulled. |

Provider abstraction in `server/src/ai/provider.ts`:

```ts
export interface AiProvider {
  name: "anthropic" | "openai" | "ollama";
  ask(input: AiAskInput): Promise<AiAskResult>;
}

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
```

Three concrete impls (`anthropic.ts`, `openai.ts`, `ollama.ts`) live alongside. Dispatcher reads `cfg.ai.provider` and returns the right one.

### 3.2 System prompt (spoiler guard)

Fixed prompt template (interpolates problem context):

```
You are a programming tutor for a Thai high-school student preparing for the
Thailand Olympiad in Informatics (TOI). You are helping them with a competitive
programming problem.

Your job: give SHORT, targeted HINTS. Ask Socratic questions when useful.
DO NOT write the full solution unless the user explicitly asks "just show me"
or "give me the answer." If they're close, point at the specific line or
algorithm gap. If they're far, suggest the right algorithm category but make
them write the code.

Language: {language}
Problem: {slug} — {title}
Statement (excerpt): {statement_md_excerpt}

Their current code:
```{language}
{code}
```

Latest local run: verdict={verdict}, runtime={runtimeMs}ms
{verdict-specific context: WA diff, RE stderr, CE compile output, TLE note, AC: congratulate}

Reply in the student's question's language (Thai or English). Be concise.
```

Statement excerpt: first 2 KB of `problem.statement_md` (PDFs are not parsed — just metadata).

Spoiler override: a "Just show me" button in the chat that prepends a fixed user message: `"Forget the spoiler guard for this one — show me a complete working solution and explain it."` before sending.

### 3.3 Persistence

New table `ai_message`:

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

Migration: same `PRAGMA table_info` pattern as `toi_counts`.

### 3.4 API

```
POST /api/ai/ask
  body: { problemId, message, includeCode?: boolean (default true), forceFullSolution?: boolean (default false) }
  → { ok: boolean, text: string, tokensIn?, tokensOut?, provider, model, error? }
  Also persists user + assistant messages to ai_message.

GET  /api/ai/history/:problemId
  → { messages: AiMessageRow[] }

DELETE /api/ai/history/:problemId
  → { deleted: number }

GET  /api/ai/status
  → { provider, model, hasKey: boolean, lastError?: string }
```

The server reads the current solution and latest run from existing repos to build context — no client-side payload of code (browser still sends `message` text only). This keeps payloads tiny and means the AI always sees the *saved* code, not unsaved buffer content. Settings page warns about this.

### 3.5 UI — workspace slide-out panel

`web/src/components/AiHelpPanel.tsx`. Mounted inside `ProblemWorkspacePage`.

States:
- **Collapsed** — a 48px-tall vertical tab pinned to the right edge of the editor area, labeled "Help" + a small chat icon. Click expands.
- **Expanded** — slides in from right, 380px wide, full editor-height. Editor remains visible (page shifts left or panel overlays at high z; choose overlay for less layout churn).
- **Inside the panel:**
  - Header: "AI Help · {provider}" + a "✕" close button.
  - Scrollable message list (user right-aligned ink pill, assistant left-aligned warm-bone bubble; markdown rendered via existing `MarkdownRender`).
  - "Provider not configured" empty state if `hasKey === false` AND provider isn't `ollama` — with a button to /settings.
  - Footer: a 1-line text input + Send button + "Just show me" link-button (smaller, opt-in).
  - Bottom-of-footer microtext: "Tokens: N in / M out · {model}".

Animation: 240ms ease-out-quart `transform: translateX`. No layout properties animated.

### 3.6 UI — problem list AI nudge

Tiny "Ask AI" link in the qualification chip's expanded popover. Lower priority than the workspace panel; mainly a discoverability hint.

---

## 4. Cheat Sheets

### 4.1 Files

```
web/src/data/cheatsheet/
  ├── cpp.md
  ├── c.md
  ├── py.md
  └── meta.ts          (TS module exporting slugified-headings index)
```

Each markdown file ~150–200 lines, organized into H2 sections:

```
## I/O
## Control flow
## Arrays and vectors
## Strings
## Sorting and searching
## Stack, queue, deque
## Maps and sets
## Math and bit tricks
## Common pitfalls (TLE, overflow, etc.)
```

Each section contains brief prose + one or more fenced code blocks. Initial content is hand-written based on TOI-level patterns. Future expansion happens by editing these files.

### 4.2 Route + rendering

`web/src/pages/CheatSheetPage.tsx` — route `/cheatsheet/:lang` (where `lang ∈ {cpp, c, py}`).

Layout:
- Left: sticky 220px-wide vertical TOC, generated from H2 headings. Active section highlighted.
- Center: rendered markdown via existing `MarkdownRender`.
- Each `<pre>` block gets a small "Copy" button overlay (top-right), reusing the docs page's copy-feedback pattern.

Language switcher at top of page (three pill buttons: C++ / C / Python). Selected = ink pill, others = secondary.

### 4.3 Meta index (for Ctrl+K)

`meta.ts` exports an array of entries built at module load:

```ts
interface CheatEntry {
  lang: "cpp" | "c" | "py";
  heading: string;          // e.g. "Sorting and searching"
  anchor: string;           // slug for #anchor
  snippet?: string;         // first ~80 chars of section body
}
```

Indexes are static (markdown is bundled at build time). No runtime parsing on every search.

### 4.4 NavPill entry

Add a "Cheat sheet" link to NavPill, between "Docs" and "Settings". Active state = current path starts with `/cheatsheet/`.

---

## 5. Ctrl+K Command Palette

### 5.1 Trigger

- Keyboard: `Ctrl+K` (Windows/Linux) and `Cmd+K` (macOS, in case user uses one later). Listener at the App level.
- Click target: an icon-only `⌘K` pill in the NavPill (right of the theme toggle, before any future button). Mobile users can click it.

### 5.2 Content sources

Three groups, ordered:

1. **Problems** — every row from `/api/problems`. Display: `{slug} · {title} · {score}/100 · {counts indicator}`. Filter against `slug + title`.
2. **Cheat sheet entries** — every entry from `meta.ts` (3 langs × ~10 sections each ≈ 30 entries). Display: `{lang} · {heading}` with the lang as a pill prefix.
3. **Docs sections** — every H2 from `DocsPage.tsx` (introspected by exporting the steps/workflows/troubleshooting arrays from that file as a shared index). Display: `Docs · {section title}`.

### 5.3 UI

`web/src/components/CommandPalette.tsx`. A centered modal overlay (dimmed backdrop, 24px radius, ~640px wide, ~520px max-height).

- Input at top (autofocus when opened).
- Live-filtered list below, grouped by source with small section headers.
- Arrow keys navigate, Enter selects, Esc closes.
- Each row shows an icon prefix (circle for problem, book for cheat sheet, doc for docs) + title + small dim caption.

Fuzzy match: simple subsequence match per group, weighted by exact-prefix matches first. No external library — `web/src/lib/fuzzy.ts` 30-line implementation.

### 5.4 Empty state

If no results: "No matches. Try a problem slug, language section, or docs term."

### 5.5 Accessibility

- ARIA role `combobox`, `listbox` for results, `option` for rows.
- Focus trapped inside modal while open.
- Esc closes; clicking backdrop closes.

---

## 6. Settings page additions

New section "AI assistant" below the existing "TOI account" section.

Fields:
- Provider dropdown: `Ollama (local, free) / Anthropic Claude / OpenAI`.
- Conditional input below the dropdown:
  - `anthropic` → "Anthropic API key" (`type="password"`, placeholder shows last-4 if set).
  - `openai` → "OpenAI API key" (`type="password"`).
  - `ollama` → "Ollama base URL" (`type="text"`, default `http://localhost:11434`) + a small "Test connection" button.
- Model name input (defaults filled per provider; user can override).
- "Save AI settings" button — same persistence pattern as TOI credentials (writes to `settings.json` via `persistAiUpdate`).

Status block: same as TOI's — "Provider: ollama", "Model: qwen2.5-coder:7b", "Last error: (none)".

---

## 7. Schema + config additions

`AppConfig.ai`:

```ts
ai: {
  provider: "anthropic" | "openai" | "ollama";
  anthropicApiKey?: string;
  anthropicModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  ollamaUrl?: string;          // default "http://localhost:11434"
  ollamaModel?: string;        // default "qwen2.5-coder:7b"
  maxTokens?: number;          // default 1024
}
```

`settings.example.json` gets a populated `ai` block with empty strings for keys and the defaults for ollama.

Persistence: new `persistAiUpdate(cfg, patch)` helper in `config.ts` mirroring `persistToiUpdate`.

---

## 8. File structure changes

```
server/src/
├── ai/
│   ├── provider.ts            ← NEW: interfaces + dispatcher
│   ├── anthropic.ts           ← NEW
│   ├── openai.ts              ← NEW
│   ├── ollama.ts              ← NEW
│   └── systemPrompt.ts        ← NEW: builds the spoiler-guarded prompt from context
├── api/
│   └── ai.ts                  ← NEW: /ask, /history, /status endpoints
├── db/
│   ├── schema.sql             ← MODIFY: add ai_message table
│   ├── client.ts              ← MODIFY: migration for ai_message
│   └── repo/
│       └── ai_messages.ts     ← NEW
└── config.ts                  ← MODIFY: AppConfig.ai + persistAiUpdate

web/src/
├── components/
│   ├── AiHelpPanel.tsx        ← NEW
│   ├── CommandPalette.tsx     ← NEW
│   ├── CheatSheetTOC.tsx      ← NEW
│   └── NavPill.tsx            ← MODIFY: + Cheat sheet link, + ⌘K button
├── data/cheatsheet/
│   ├── cpp.md                 ← NEW
│   ├── c.md                   ← NEW
│   ├── py.md                  ← NEW
│   └── meta.ts                ← NEW: searchable index
├── lib/
│   ├── ai.ts                  ← NEW: api client for AI endpoints
│   ├── fuzzy.ts               ← NEW: subsequence fuzzy match
│   └── hotkey.ts              ← NEW: useHotkey hook
├── pages/
│   ├── CheatSheetPage.tsx     ← NEW
│   ├── DocsPage.tsx           ← MODIFY: export sections index for palette
│   ├── ProblemWorkspacePage.tsx ← MODIFY: mount AiHelpPanel
│   └── SettingsPage.tsx       ← MODIFY: add AI provider section
└── App.tsx                    ← MODIFY: /cheatsheet/:lang route, mount CommandPalette globally
```

---

## 9. Anti-pattern compliance

Verified against impeccable shared design laws:

- ✅ **No `#000`/`#fff`** — all neutrals use the existing token system.
- ✅ **No side-stripe borders** — AI message bubbles use background tint + full borders, not left-stripe.
- ✅ **No gradient text** — single solid color throughout.
- ✅ **No glassmorphism** — backdrop on Ctrl+K palette is solid dim `var(--color-ink)/30`, not blur.
- ✅ **No hero-metric template** — token counter is a single small line in footer, not a card.
- ✅ **No identical card grid** — message bubbles vary by role (left/right alignment, different surface tones).
- ✅ **No modal as first thought** — AI Help is a panel, not a modal. Only Ctrl+K is a modal (it's the standard pattern users expect).
- ✅ **Motion: transform/opacity only** — panel slide, palette fade-in. No animated layout properties.
- ✅ **Ease-out exponential** — `cubic-bezier(0.16, 1, 0.3, 1)` on both surfaces.
- ✅ **No em dashes in shipped strings.** Spec doc uses them only in prose here.

Color strategy: still **Restrained** — warm cream + ink + signal orange. The AI panel introduces no new colors; it reuses the existing palette.

Category-reflex check:
- First-order: "AI chat → purple/blue gradient bubbles" — explicitly avoided. We use warm bone bubbles for assistant + ink pills for user.
- Second-order: "olympiad prep AI → 'Solve this for me' button" — explicitly avoided. Spoiler guard is default.

---

## 10. What's NOT in this design

- ❌ Streaming response UI. Backend buffers; response arrives whole.
- ❌ Function calling / tool use. Pure text Q&A.
- ❌ Image input (no screenshot-of-error feature).
- ❌ Cross-problem AI memory ("remember when I asked about A1-005…"). Each problem has its own thread.
- ❌ AI-generated cheat sheet content. Human-curated only.
- ❌ Cheat sheet "favorites" or per-user notes layer. Read-only.
- ❌ Voice input / TTS.
- ❌ Rate limiting (single user, single machine).
- ❌ Per-message editing / regeneration. Append-only conversation.
- ❌ AI assistance during exam mode (no exam mode exists in this app).
