# PDF Reader + Candy-Crush Problem List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline TDD execution unless the user explicitly approves subagent runs. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cached TOI PDFs, a winding problem path, manual TOI score sync, and a persistent qualification chip for TOI Zero prep.

**Architecture:** Extend the existing Bun/Hono/SQLite API with idempotent schema migration, file-backed PDF cache helpers, TOI fetch/scrape utilities, and small Hono routers. Extend the React app with pure geometry/status helpers, focused display components, and a workspace PDF tab that falls back to markdown.

**Tech Stack:** Bun 1.3.x, Hono, bun:sqlite, React 18, TypeScript, Tailwind v4 tokens, browser-native PDF iframe.

**Design source of truth:** [info/DESIGN.md](../../../info/DESIGN.md). Preserve warm Mastercard surfaces, circular nodes, Light Signal Orange arcs, no gradient text, no glassmorphism, no hero-metric cards.

---

## File Structure

```
server/src/
├── api/
│   ├── pdf.ts                 (new: sync/serve PDF routes)
│   ├── qualification.ts       (new: derived qualification route)
│   ├── problems.ts            (modify: expose PDF cache metadata)
│   └── toi.ts                 (modify: submit + score sync/progress)
├── db/
│   ├── client.ts              (modify: idempotent column migration)
│   ├── schema.sql             (modify: new score columns)
│   └── repo/
│       ├── pdfCache.ts        (new: disk cache helpers)
│       └── problems.ts        (modify: score fields + update helpers)
└── toi/
    ├── fetchPdf.ts            (new: authenticated PDF fetch)
    ├── scrapeScores.ts        (new: HTML score parser/fetcher)
    └── submit.ts              (modify: export cookie helper)

web/src/
├── components/
│   ├── PdfViewer.tsx
│   ├── ProblemNode.tsx
│   ├── QualificationChip.tsx
│   ├── SectionBand.tsx
│   └── ZigzagPath.tsx
├── lib/
│   ├── path-geometry.ts
│   └── status.ts
└── pages/
    ├── ProblemListPage.tsx
    └── ProblemWorkspacePage.tsx
```

---

## Task 1: DB fields + qualification math

**Files:**
- Modify: `server/src/db/schema.sql`
- Modify: `server/src/db/client.ts`
- Modify: `server/src/db/repo/problems.ts`
- Create: `server/src/api/qualification.ts`
- Test: `server/tests/db/repo.test.ts`

- [ ] **Step 1: Write failing repo tests**

Add coverage that a problem row has `toi_best_score = 0`, `toi_last_sync_at = null`, `updateToiScore` keeps the max score, and qualification derives `20 A1 + 20 A2/A3`.

Run: `bun --cwd server test tests/db/repo.test.ts`
Expected: fail on missing fields/methods.

- [ ] **Step 2: Implement schema + migration**

Add columns to `problem`:

```sql
toi_best_score INTEGER NOT NULL DEFAULT 0,
toi_last_sync_at TEXT
```

Add `client.ts` migration:

```ts
const cols = db.query("PRAGMA table_info(problem)").all() as { name: string }[];
if (!cols.some((c) => c.name === "toi_best_score")) {
  db.exec("ALTER TABLE problem ADD COLUMN toi_best_score INTEGER NOT NULL DEFAULT 0;");
  db.exec("ALTER TABLE problem ADD COLUMN toi_last_sync_at TEXT;");
}
```

- [ ] **Step 3: Implement repo helpers**

Expose score fields in `ProblemRow`, then add:

```ts
updateToiScore(id: number, score: number, syncedAt: string): boolean
qualification(): { a1Count: number; a2a3Count: number; qualified: boolean }
```

- [ ] **Step 4: Add API route**

`GET /api/qualification` returns:

```json
{ "a1Count": 0, "a2a3Count": 0, "qualified": false }
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
bun --cwd server test tests/db/repo.test.ts
bun --cwd server test
git add server/src/db server/src/api/qualification.ts server/tests/db/repo.test.ts
git commit -m "feat(server): add TOI score fields and qualification"
```

---

## Task 2: PDF cache + authenticated PDF routes

**Files:**
- Create: `server/src/db/repo/pdfCache.ts`
- Create: `server/src/toi/fetchPdf.ts`
- Create: `server/src/api/pdf.ts`
- Modify: `server/src/toi/submit.ts`
- Modify: `server/src/index.ts`
- Test: `server/tests/toi/fetchPdf.test.ts`

- [ ] **Step 1: Write failing unit tests**

Test cookie expiry detection:

```ts
expect(isExpiredLoginHtml("text/html; charset=utf-8", "Please log in")).toBe(true);
expect(isExpiredLoginHtml("application/pdf", "%PDF-1.7")).toBe(false);
```

Run: `bun --cwd server test tests/toi/fetchPdf.test.ts`
Expected: fail because module does not exist.

- [ ] **Step 2: Implement cache helpers**

`pdfCache.ts` owns:

```ts
pdfPath(root: string, slug: string): string
hasPdf(root: string, slug: string): boolean
readPdf(root: string, slug: string): Uint8Array | null
writePdfAtomic(root: string, slug: string, bytes: Uint8Array): void
```

- [ ] **Step 3: Implement TOI PDF fetch**

`fetchPdf.ts` fetches:

```txt
{baseUrl}/tasks/{slug}/statements/TH
```

Uses exported `buildCookieHeader`, rejects HTML login pages, and returns `{ ok: true, bytes }` or `{ ok: false, error }`.

- [ ] **Step 4: Add routes**

Routes:

```txt
GET  /api/problems/:id/pdf
POST /api/problems/:id/pdf/sync
POST /api/problems/sync-pdfs
```

Serve cached PDFs with `content-type: application/pdf`; return 404 when missing.

- [ ] **Step 5: Verify and commit**

Run:

```bash
bun --cwd server test tests/toi/fetchPdf.test.ts
bun --cwd server test
git add server/src/db/repo/pdfCache.ts server/src/toi/fetchPdf.ts server/src/api/pdf.ts server/src/toi/submit.ts server/src/index.ts server/tests/toi/fetchPdf.test.ts
git commit -m "feat(server): cache and serve TOI statement PDFs"
```

---

## Task 3: Score scraper + manual sync

**Files:**
- Create: `server/src/toi/scrapeScores.ts`
- Modify: `server/src/api/toi.ts`
- Test: `server/tests/toi/scrapeScores.test.ts`

- [ ] **Step 1: Write failing parser tests**

Cover scores like:

```html
<tr data-submission="1"><td>100 / 100</td></tr>
<tr data-submission="2"><td>76 / 100</td></tr>
```

Expected max: `100`.

- [ ] **Step 2: Implement parser/fetcher**

Export:

```ts
parseBestScore(html: string): number
isLoginHtml(html: string): boolean
fetchBestScore(input): Promise<{ ok: true; score: number } | { ok: false; error: string }>
```

- [ ] **Step 3: Implement sync endpoints**

Add:

```txt
POST /api/toi/sync-scores
GET  /api/toi/sync-progress
```

Concurrency cap: 8. Keep in-memory progress for this single-user local app. Manual only.

- [ ] **Step 4: Verify and commit**

Run:

```bash
bun --cwd server test tests/toi/scrapeScores.test.ts
bun --cwd server test
git add server/src/toi/scrapeScores.ts server/src/api/toi.ts server/tests/toi/scrapeScores.test.ts
git commit -m "feat(toi): sync best scores from TOI"
```

---

## Task 4: Frontend pure helpers

**Files:**
- Create: `web/src/lib/path-geometry.ts`
- Create: `web/src/lib/status.ts`
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/api.ts`

- [ ] **Step 1: Implement pure helpers**

`nodeDiameter(section, idx, total)`, `nodeOffset(idx)`, `nodeStatus(problem, openedIds)`, and `qualificationFromProblems(problems)`.

- [ ] **Step 2: Extend API client**

Add PDF, qualification, and sync-score calls. Problem type gains `toi_best_score`, `toi_last_sync_at`, and optional `has_pdf`.

- [ ] **Step 3: Verify**

Run:

```bash
bun --cwd web build
git add web/src/lib
git commit -m "feat(web): add path geometry and progress helpers"
```

---

## Task 5: Candy-crush path UI

**Files:**
- Create: `web/src/components/ProblemNode.tsx`
- Create: `web/src/components/ZigzagPath.tsx`
- Create: `web/src/components/SectionBand.tsx`
- Create: `web/src/components/QualificationChip.tsx`
- Modify: `web/src/pages/ProblemListPage.tsx`
- Modify: `web/src/styles/globals.css`

- [ ] **Step 1: Build components**

Use 88-140px circles, Light Signal Orange SVG arcs, section tone bands, search alpha dimming, plus icon-only Add button, and a transform-only suggested pulse.

- [ ] **Step 2: Wire list page**

Group by `A1`, `A2`, `A3`. Soft-gate A2/A3 with one sessionStorage-backed confirm. All nodes remain clickable.

- [ ] **Step 3: Wire qualification chip**

Sticky top-right, compact by default, expanded on hover/click, manual `Sync from TOI` button.

- [ ] **Step 4: Verify and commit**

Run:

```bash
bun --cwd web build
git add web/src/components web/src/pages/ProblemListPage.tsx web/src/styles/globals.css
git commit -m "feat(web): replace problem grid with winding TOI path"
```

---

## Task 6: Workspace PDF panel

**Files:**
- Create: `web/src/components/PdfViewer.tsx`
- Modify: `web/src/pages/ProblemWorkspacePage.tsx`

- [ ] **Step 1: Build PDF viewer**

Use:

```tsx
<iframe src={`/api/problems/${problemId}/pdf#zoom=page-width`} />
```

Wrap with `.pdf-dark-frame` so `html.dark` applies `filter: invert(1) hue-rotate(180deg)`.

- [ ] **Step 2: Wire workspace tabs**

Left panel toggle: `PDF` / `Markdown`. If cached, default to PDF. If missing and TOI source URL exists, show `Download PDF`.

- [ ] **Step 3: Verify and commit**

Run:

```bash
bun --cwd web build
git add web/src/components/PdfViewer.tsx web/src/pages/ProblemWorkspacePage.tsx
git commit -m "feat(web): add cached PDF reader to workspace"
```

---

## Task 7: Full verification

- [ ] **Step 1: Server tests**

Run: `bun --cwd server test`
Expected: all tests pass.

- [ ] **Step 2: Web build**

Run: `bun --cwd web build`
Expected: production bundle succeeds.

- [ ] **Step 3: Manual smoke**

Run server and web dev. Verify:
- problem list shows A1/A2/A3 winding path
- search dims non-matches without reflow
- qualification chip expands and sync button calls the API
- workspace downloads/opens PDF or falls back to markdown
- dark mode inverts PDF frame

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify PDF reader and TOI path flow"
```

---

## Self-Review Summary

**Spec coverage:** PDF cache/routes/viewer, bulk PDF sync, candy-crush path, 5 statuses, suggested pulse, section bands, search, soft gate, score sync, and qualification endpoint are covered.

**Placeholders:** none in implementation steps; all commands and APIs are concrete.

**Defaults chosen:** score sync uses polling progress, not SSE, because the app is single-user local and polling keeps the Hono surface smaller.
