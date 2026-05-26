# PDF Reader + Candy-Crush Problem List — Design Spec

**Status:** Approved
**Date:** 2026-05-26
**Register:** product (single-user app)
**Design source of truth:** [info/DESIGN.md](../../../info/DESIGN.md) (Mastercard system)

---

## 1. Goal

Two coordinated improvements to TOIZero:

1. **In-app PDF reading.** Read TOI problem statements inside the app instead of bouncing to the TOI website. PDFs are downloaded once, cached on disk, and displayed in the workspace next to the editor.
2. **Candy-crush problem list.** Replace the current 3-column constellation grid with a vertical winding path that escalates difficulty (A1 → A2 → A3), with real TOI qualification tracking baked in (20 A1 ≥80 pts, 20 A2+A3 ≥80 pts).

These together transform the app from "code editor with metadata" into a **journey through TOI prep with a real progress milestone**.

---

## 2. UX principles

These are the rules the implementation must respect. Each is justified by either the design source of truth (`info/DESIGN.md`) or a UX failure mode we are deliberately avoiding.

| Principle | Why |
|---|---|
| **Free-roam, soft-gate.** Every problem is clickable. Locked sections show a confirm dialog, not a hard block. | TOI itself doesn't lock; locking would frustrate exploratory practice. |
| **Visual journey, not gamification overlay.** The "stage" feel comes from the winding path + difficulty escalation + status rings, not from badges, XP, or sounds. | Anti-bans: no hero-metric template, no decorative chrome. |
| **One screen, one job.** Problem list is the path. Workspace is read+code. PDF lives in workspace, not as a separate route. | Avoid context switches; mirror programming.in.th's read-while-typing flow. |
| **Status legibility at glance.** Five states (unsolved / attempted / ≥80 / 100 / locked) must be distinguishable without reading text. | Practice involves quick scan-then-pick; labels slow it down. |
| **Qualification chip persistent.** "X/20 · Y/20 · QUALIFIED?" visible at all times on the list page. | The qualification rule IS the user's mission; hiding it loses the throughline. |
| **PDFs respect dark mode.** Inverted with hue-rotate filter when `html.dark` is active. | Reading a glaring white PDF on a near-black UI breaks immersion. |
| **No sync surprises.** Score sync is manual ("Sync from TOI" button) with progress indicator. Never auto-poll. | Manual = predictable + user controls bandwidth + cookie freshness. |
| **Smaller nodes.** Baseline node ≈90px diameter (down from 280px). Maximum ≈140px for late-A3. | User explicit request; also helps fit ~12 nodes in viewport. |

---

## 3. PDF reading

### 3.1 Storage layout

```
problems/
  A1-001/
    statement.pdf           ← downloaded once from TOI, ~50–500 KB
  A1-002/
    statement.pdf
  ...
```

The directory is already in `.gitignore`. Sub-directories created on first download. If a PDF download fails, the file is not written (no partial files).

### 3.2 Server endpoints

```
POST /api/problems/:id/pdf/sync          → download fresh from TOI, return {ok, sizeKb}
GET  /api/problems/:id/pdf               → serve the cached file (200 + application/pdf)
                                          → 404 if not yet downloaded
POST /api/problems/sync-pdfs             → bulk: download every missing PDF in parallel
                                          → returns {synced, skipped, failed[]}
```

The PDF download uses the same Cookie header machinery as TOI submit-through (`server/src/toi/submit.ts`'s `buildCookieHeader`). Endpoint: `https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/{slug}/statements/TH`.

**Cookie expiry detection.** TOI returns 200 with an HTML login page when the cookie is invalid (Tornado pattern). The fetchPdf helper sniffs the response: if `Content-Type` starts with `text/html` OR the first 200 bytes contain `"Please log in"` / `"login"`, it treats as expired and returns `{error: "cookie expired, re-paste in settings.json"}`. Only `application/pdf` responses are written to disk.

### 3.3 Workspace integration

The workspace page's left panel (currently markdown statement) gets a new mode toggle:

```
[ PDF ]  [ Markdown ]
```

`PDF` is the default once a PDF is cached. `Markdown` shows the typed-in statement (existing behavior, fallback for problems that aren't TOI imports).

If PDF not yet cached and `io_mode` indicates a TOI problem (sourceUrl matches TOI host), show a "Download PDF" inline action on the panel header that triggers `POST /api/problems/:id/pdf/sync`.

### 3.4 PDF rendering technique

**Use `<iframe>` with `src="/api/problems/:id/pdf#zoom=page-width"`.**

Rationale: browser-native PDF viewer is free, has Ctrl+F search and zoom built in, no extra JS bundle, no canvas re-render perf cost. PDF.js is a 1MB+ dependency for marginal control gains in this single-user context.

Dark mode handling: when `html.dark` is set, the iframe is wrapped in a div with `filter: invert(1) hue-rotate(180deg)` which approximates a dark PDF. Text stays legible. Images get inverted (acceptable for diagrams; the dark/light toggle in nav lets users flip back if a problem has color-sensitive figures).

---

## 4. Candy-crush problem list

### 4.1 Layout

Single vertical column, max-width 720px, centered. Three section bands stack vertically:

```
┌─────────────── A1 — Basics (warm cream band) ────────────────┐
│                                                                │
│       ◯ (A1-001)                                              │
│              ╲                                                 │
│               ╲                                                │
│                ◯ (A1-002)                                     │
│               ╱                                                │
│              ╱                                                 │
│       ◯ (A1-003)                                              │
│              ╲                                                 │
│           ...zigzag continues for 70 A1 nodes...               │
│                                                                │
├─────────────── A2 — Intermediate (deeper putty band) ────────┤
│        (continues zigzag, slightly larger nodes)              │
├─────────────── A3 — Advanced (muted clay band) ───────────────┤
│        (continues, largest nodes)                              │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Node sizing

Within each section, nodes grow ~15% from first to last:

| Section | First-node diameter | Last-node diameter |
|---|---|---|
| A1 (70 problems) | 88px | 100px |
| A2 (59 problems) | 100px | 116px |
| A3 (28 problems) | 116px | 140px |

Computed as `diameter = baseFor(section) + (idx / sectionTotal) * growthFor(section)`. No conditional `if` chains in render — a single function.

### 4.3 Zigzag math

Each node sits at a horizontal offset oscillating around the column center. With a single column width of 600px and a max horizontal swing of ±200px:

```ts
const swing = 200;
const offset = Math.sin((idx / 4) * Math.PI) * swing;  // 4-node wavelength
```

The connecting curve between node N and N+1 is a single SVG `<path>` using a cubic Bezier whose control points place the bow on the convex side of the swing. Stroke: 1.25px Light Signal Orange (existing `OrbitalArc` style).

### 4.4 Status states

Each node has a status that maps to a fill + ring + decoration:

| State | Ring color | Fill | Decoration |
|---|---|---|---|
| `unsolved` | `--color-dust` 1.5px | transparent | letter watermark (first char of title) at 30% ink |
| `attempted` (any run exists, no ≥80) | `--color-signal-light` 1.5px | `--color-signal-light` at 15% alpha | letter watermark |
| `≥80 pts` | `--color-signal-light` 2px | `--color-signal-light` at 35% alpha | thin check icon bottom-right |
| `100 pts` | `--color-signal-light` 2.5px | `--color-signal-light` at 55% alpha | filled check satellite |
| `locked` (A2 or A3 before milestone) | `--color-dust` dashed 1px | transparent | small lock glyph centered, no letter |

States 1–4 trigger when the user has actually opened the problem; locked state ONLY applies if the section gate isn't met AND the problem hasn't been opened yet (one click "unlocks" it visually since intent is clear).

### 4.5 Suggested-next pulse

The first `unsolved` node in the lowest-section that isn't locked gets a subtle pulse animation:

```css
@keyframes suggested-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.04); }
}
.suggested { animation: suggested-pulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
```

GPU-accelerated transform only; no layout properties animated (per design law).

### 4.6 Section bands

Background color shifts at section boundaries via three full-width sticky-positioned background div(s) behind the path:

| Section | Light mode bg | Dark mode bg |
|---|---|---|
| A1 | `#F3F0EE` (Canvas Cream) | `#1A1815` |
| A2 | `#ECE6DD` | `#1F1C18` |
| A3 | `#E3D9CB` | `#23201B` |

Discrete tone shifts — NOT a gradient (per `info/DESIGN.md` color philosophy). Each section's first node has the section's ghost-watermark headline ("A1", "A2", "A3") in `--color-whisper` at 96px font-size, weight 500, behind it (already an established motif).

### 4.7 Section headers

Above each section's first node:

```
• A1 — BASICS
3 / 70 solved · 1 / 20 toward A1 milestone
```

`• A1 — BASICS` uses the existing `EyebrowLabel` component verbatim. The fraction is small slate-gray text.

### 4.8 Qualification chip (sticky)

`position: fixed`, top: 88px (clears the 56px-tall nav pill's 24px top margin + height), right: 24px, z-index 30 (below the nav's z-40). Pill-shaped, ink-on-cream:

```
┌──────────────────────────────────┐
│ ●  2/20 A1  ·  0/20 A2+A3       │  ← collapsed
└──────────────────────────────────┘
```

On hover/click, expands to:

```
┌─────────────────────────────────────┐
│ ●  TOI Pre-Camp qualification       │
│                                     │
│ A1 (≥80 pts)        2 / 20  ▰▱▱▱   │
│ A2+A3 (≥80 pts)     0 / 20  ▱▱▱▱   │
│                                     │
│ Status: NOT QUALIFIED               │
│ [Sync from TOI]                     │
└─────────────────────────────────────┘
```

The dot color reflects status: dust grey (not qualified), signal-light (qualified). The bar fills are derived from counts — never embed both as a "hero metric template" (the absolute ban). The compact form is purely informative; the expanded form is the actionable surface.

### 4.9 Soft section gate

If the user clicks an A2 node before A1 milestone is met:

```
┌─────────────────────────────────────────────┐
│ This section usually opens after            │
│ 20 A1 problems at ≥80 pts. You're at 2/20. │
│                                             │
│ [ Continue anyway ]   [ Stay in A1 ]        │
└─────────────────────────────────────────────┘
```

Inline modal. Dismissing once during a session sets a `sessionStorage` flag so subsequent A2/A3 clicks skip the warning until reload — friction once, never twice.

### 4.10 Search / filter

Sticky search input above the qualification chip, at the top of the path:

```
[ 🔎  Search problems by title or slug…  ]
```

Filters the path live. Matching nodes stay full-color; non-matching nodes drop to 15% alpha. The path lines stay drawn (so the geometry doesn't reflow). Search clears on Esc.

This replaces the previous "Add problem" button position — Add moves into a small "+" icon-only button next to the search field.

---

## 5. Score sync

### 5.1 Schema change

```sql
ALTER TABLE problem ADD COLUMN toi_best_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE problem ADD COLUMN toi_last_sync_at TEXT;
```

`toi_best_score` ranges 0–100. `toi_last_sync_at` is ISO-8601 UTC.

**Migration note.** The current `openDb` in `server/src/db/client.ts` runs `schema.sql` (all `CREATE TABLE IF NOT EXISTS`) on every boot, which silently skips existing tables. The new columns won't appear on an existing DB. Add a tiny migration step at the end of `schema.sql`:

```sql
-- Idempotent column add via PRAGMA inspection.
-- Bun's sqlite supports inline IF NOT EXISTS at SQL level via this pattern:
CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT UNIQUE);

INSERT OR IGNORE INTO _migrations (name) VALUES ('add_toi_best_score');
-- The ADD COLUMN below is guarded by a CASE in code: see client.ts migration runner.
```

Actually, simpler: in `server/src/db/client.ts` after the schema exec, run:

```ts
const cols = db.query("PRAGMA table_info(problem)").all() as { name: string }[];
if (!cols.some((c) => c.name === "toi_best_score")) {
  db.exec("ALTER TABLE problem ADD COLUMN toi_best_score INTEGER NOT NULL DEFAULT 0;");
  db.exec("ALTER TABLE problem ADD COLUMN toi_last_sync_at TEXT;");
}
```

This is a single conditional ALTER and handles both fresh DBs (schema.sql already includes the new columns; check skips) and existing DBs (check passes; ALTER fires). Fresh schema.sql gets the columns added directly to the CREATE TABLE.

### 5.2 Sync endpoint

```
POST /api/toi/sync-scores
```

For each problem in the DB:
1. Fetch `https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/{slug}/submissions` with the stored cookie.
2. Parse all `<tr data-submission="…">` rows from the submission list table.
3. Extract the max numeric score from the "X / 100" cells.
4. Update `problem.toi_best_score` if higher than current; bump `toi_last_sync_at`.

Run with a concurrency cap of 8 (avoid hammering TOI). Total ~157 requests / 8 = ~20 batches. Estimated ~30–60 seconds. UI shows a progress meter ("Syncing 47 / 157…") sourced from a polled endpoint `GET /api/toi/sync-progress` or via SSE.

### 5.3 Qualification calculation

Derived from `problem` rows, never stored:

```ts
const a1Count = problems.filter((p) => p.category === "A1" && p.toi_best_score >= 80).length;
const a2a3Count = problems.filter((p) => ["A2","A3"].includes(p.category) && p.toi_best_score >= 80).length;
const qualified = a1Count >= 20 && a2a3Count >= 20;
```

Endpoint: `GET /api/qualification` returns `{a1Count, a2a3Count, qualified}`.

---

## 6. File structure changes

```
server/src/
├── api/
│   ├── pdf.ts                       ← NEW: pdf sync + serve routes
│   ├── qualification.ts             ← NEW: qualification endpoint
│   ├── toi.ts                       ← MODIFY: add /sync-scores route
│   └── problems.ts                  ← MODIFY: include toi_best_score in serialized rows
├── db/
│   ├── schema.sql                   ← MODIFY: add toi_best_score + toi_last_sync_at
│   └── repo/
│       ├── problems.ts              ← MODIFY: getById/listAll include new columns
│       └── pdfCache.ts              ← NEW: filesystem PDF cache helpers
└── toi/
    ├── submit.ts                    (existing)
    ├── fetchPdf.ts                  ← NEW: download PDF via cookie
    └── scrapeScores.ts              ← NEW: parse submissions HTML

web/src/
├── components/
│   ├── ProblemNode.tsx              ← NEW: replaces ProblemCircle for the path
│   ├── ZigzagPath.tsx               ← NEW: renders the SVG curves
│   ├── SectionBand.tsx              ← NEW: warm-tone background section
│   ├── QualificationChip.tsx        ← NEW: sticky top-right meter
│   ├── PdfViewer.tsx                ← NEW: iframe + dark-mode invert wrapper
│   └── ProblemCircle.tsx            (existing — kept for AddEditModal preview maybe; otherwise delete)
├── pages/
│   ├── ProblemListPage.tsx          ← REWRITE: zigzag layout
│   ├── ProblemWorkspacePage.tsx     ← MODIFY: PDF panel + tab toggle
│   └── ProblemEditModal.tsx         (existing, unchanged)
└── lib/
    ├── path-geometry.ts             ← NEW: pure function returning node positions
    └── status.ts                    ← NEW: pure function mapping (run history, toi_best_score) → state
```

---

## 7. Anti-pattern compliance

Verified against the `impeccable` shared design laws:

- ✅ **No `#000`/`#fff`** — all neutrals are tinted (see token table). Dark mode warm-black is `#1A1815`, light cream is `#F3F0EE`.
- ✅ **No side-stripe borders** — qualification chip uses full pill border, no left-stripe; section bands use full-width tone shifts, no accent edge.
- ✅ **No gradient text** — all text is single solid color.
- ✅ **No glassmorphism** — no backdrop-filter blurs anywhere.
- ✅ **No hero-metric template** — qualification chip is a pill, not a big-number-with-supporting-stats card.
- ✅ **No identical card grid** — zigzag path is explicitly non-grid, asymmetric, sized by progression.
- ✅ **No modal as first thought** — section-gate confirm is inline; PDF is panel, not modal; only score-sync progress is a transient toast.
- ✅ **No em dashes in code/UI copy.** Spec doc uses them only here in prose, not in shipped strings.
- ✅ **Motion: transform-only** — `suggested-pulse` animates `transform: scale`; section transitions use `transition: background-color`. No animated layout properties.
- ✅ **Ease-out exponential** — `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-quart) on pulse.

Color strategy: **Restrained**. Warm cream surfaces + ink black + signal orange as the single ≤10% accent. No deviation from existing register.

Category-reflex check:
- First-order: "competitive programming → green checkmarks + neon" — explicitly avoided. We use signal orange on warm cream.
- Second-order: "TOI prep → flat dashboard with progress bars" — explicitly avoided. The candy-crush winding path is the antidote.

---

## 8. What's NOT in this design

Out of scope for this work — listed to be explicit:

- ❌ Achievement badges, XP points, streaks. Just status rings.
- ❌ Sounds, haptics.
- ❌ Animated path drawing on first load. Static SVG, instant.
- ❌ Per-problem time tracker.
- ❌ Leaderboard, social, sharing.
- ❌ PDF annotation. Read-only iframe.
- ❌ OCR or text extraction from PDFs. The Markdown fallback is for users to type, not to auto-generate.
- ❌ Per-subtask score breakdown from TOI. Just `max(score)`.
