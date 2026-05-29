import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Problem, ProblemFilterMode, ProblemSortMode, Qualification } from "../lib/types";
import { nodePoint, problemSection, type ProblemSection } from "../lib/path-geometry";
import { filterProblem, isSectionLocked, nodeStatus, qualificationFromProblems, sortProblems } from "../lib/status";
import { ProblemNode } from "../components/ProblemNode";
import { ZigzagPath } from "../components/ZigzagPath";
import { SectionBand } from "../components/SectionBand";
import { QualificationChip } from "../components/QualificationChip";
import { SyncFromToiButton } from "../components/SyncFromToiButton";
import { DownloadAllPdfsButton } from "../components/DownloadAllPdfsButton";
import { PillButton } from "../components/PillButton";
import { EyebrowLabel } from "../components/EyebrowLabel";

const SECTION_META: Record<ProblemSection, { title: string; milestone: (q: Qualification) => string }> = {
  A1: { title: "BASICS", milestone: (q) => `${Math.min(q.a1Count, 20)} / 20 toward A1 milestone` },
  A2: { title: "INTERMEDIATE", milestone: (q) => `${Math.min(q.a2a3Count, 20)} / 20 toward A2+A3 milestone` },
  A3: { title: "ADVANCED", milestone: (q) => `${Math.min(q.a2a3Count, 20)} / 20 toward A2+A3 milestone` },
};

const SECTION_ORDER: ProblemSection[] = ["A1", "A2", "A3"];

export function ProblemListPage({ onAdd }: { onAdd: () => void }) {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [qualification, setQualification] = useState<Qualification>({ a1Count: 0, a2a3Count: 0, qualified: false });
  const [query, setQuery] = useState("");
  const [openedIds, setOpenedIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("toizero-opened-problems") ?? "[]")); }
    catch { return new Set(); }
  });
  const [gateProblem, setGateProblem] = useState<Problem | null>(null);
  const [submitAllRunning, setSubmitAllRunning] = useState(false);
  const [submitAllMsg, setSubmitAllMsg] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<ProblemSortMode>("slug");
  const [filterMode, setFilterMode] = useState<ProblemFilterMode>("all");

  const load = useCallback(async () => {
    const list = await api.listProblems();
    setProblems(list);
    try { setQualification(await api.getQualification()); }
    catch { setQualification(qualificationFromProblems(list)); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const groups: Record<ProblemSection, Problem[]> = { A1: [], A2: [], A3: [] };
    for (const problem of problems ?? []) groups[problemSection(problem.category)].push(problem);
    return groups;
  }, [problems]);

  const statusFor = useCallback(
    (problem: Problem) => nodeStatus(problem, qualification, openedIds),
    [openedIds, qualification]
  );

  const sortedGrouped = useMemo(() => ({
    A1: sortProblems(grouped.A1, sortMode, statusFor),
    A2: sortProblems(grouped.A2, sortMode, statusFor),
    A3: sortProblems(grouped.A3, sortMode, statusFor),
  }), [grouped, sortMode, statusFor]);

  const suggestedId = useMemo(() => {
    for (const section of SECTION_ORDER) {
      const next = sortedGrouped[section].find((problem) => nodeStatus(problem, qualification, openedIds) === "unsolved");
      if (next) return next.id;
    }
    return null;
  }, [openedIds, qualification, sortedGrouped]);

  const normalizedQuery = query.trim().toLowerCase();

  function rememberOpen(id: number) {
    setOpenedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("toizero-opened-problems", JSON.stringify([...next]));
      return next;
    });
  }

  function openProblem(problem: Problem) {
    const locked = isSectionLocked(problem, qualification, openedIds);
    if (locked && sessionStorage.getItem("toizero-soft-gate-ok") !== "1") {
      setGateProblem(problem);
      return;
    }
    rememberOpen(problem.id);
    navigate(`/p/${problem.id}`);
  }

  async function submitAllToToi() {
    const targetCount = problems?.length ?? 0;
    if (!window.confirm(`Submit every problem with a saved local solution to TOI.\n\nThis sends real submissions to your TOI account. Each one shows up in your submission history. Continue?`)) {
      return;
    }
    setSubmitAllRunning(true);
    setSubmitAllMsg("Starting...");
    try {
      const start = await api.startSubmitAll();
      if (start.total === 0) {
        setSubmitAllMsg("No saved solutions yet — write code on a problem first.");
        setSubmitAllRunning(false);
        return;
      }
      setSubmitAllMsg(`Submitting 0 / ${start.total}...`);
      // Poll progress every 1.5s
      const tick = setInterval(async () => {
        try {
          const p = await api.getSubmitAllProgress();
          setSubmitAllMsg(`Submitting ${p.done} / ${p.total} · ${p.succeeded} ok · ${p.failed.length} failed`);
          if (!p.running) {
            clearInterval(tick);
            setSubmitAllRunning(false);
            setSubmitAllMsg(`Done. ${p.succeeded} / ${p.total} submitted${p.failed.length ? ` · ${p.failed.length} failed` : ""}.`);
            await load();
          }
        } catch {
          // ignore transient
        }
      }, 1500);
      // ignore the initial reference to start beyond logging total
      void start;
      void targetCount;
    } catch (e: any) {
      setSubmitAllMsg(e?.message ?? String(e));
      setSubmitAllRunning(false);
    }
  }

  async function toggleCounts(problem: Problem) {
    const nextCounts = problem.toi_counts !== 1;
    const result = await api.updateCounts(problem.id, nextCounts);
    if (result.problem) {
      setProblems((current) => current?.map((p) => p.id === problem.id ? { ...p, ...result.problem } : p) ?? current);
      try { setQualification(await api.getQualification()); } catch { /* noop */ }
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 pt-32">
      {/* Top-right cluster: qualification pill on top, sync action below.
          Lifted out of the chip itself so the sync CTA isn't gated behind a
          hover/click. The vertical gap is intentionally tight (12px) so they
          read as a cluster, not two unrelated controls. */}
      <div className="fixed right-6 top-[88px] z-30 flex flex-col items-end gap-3">
        <QualificationChip qualification={qualification} />
        <SyncFromToiButton onSynced={load} />
        <DownloadAllPdfsButton onDownloaded={load} />
      </div>

      <div className="mx-auto mb-8 max-w-[720px]">
        <div className="mb-4"><EyebrowLabel>Library</EyebrowLabel></div>
        <div className="mb-8 flex items-end justify-between gap-4">
          <h1 className="max-w-[620px]">TOI Zero path.</h1>
          <div className="flex items-center gap-2">
            <PillButton variant="secondary" onClick={submitAllToToi} disabled={submitAllRunning}>
              {submitAllRunning ? "Submitting..." : "Submit all to TOI"}
            </PillButton>
            <button
              type="button"
              onClick={onAdd}
              title="Add problem"
              aria-label="Add problem"
              className="motion-press grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-[var(--color-ink)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-selection-tint)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
        <div className="sticky top-24 z-20">
          <div className="path-search-shell flex items-center gap-3 rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] px-5 py-3 shadow-[var(--shadow-nav)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-slate)]">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
              placeholder="Search problems by title or slug..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-slate)]"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
            <label className="path-control-pill">
              <span>Sort</span>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as ProblemSortMode)}>
                <option value="slug">Slug</option>
                <option value="score">Score</option>
                <option value="status">Status</option>
                <option value="unsolved-first">Unsolved first</option>
              </select>
            </label>
            <label className="path-control-pill">
              <span>Filter</span>
              <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as ProblemFilterMode)}>
                <option value="all">All</option>
                <option value="unsolved">Unsolved</option>
                <option value="80+">80+</option>
                <option value="100">100</option>
                <option value="counted">Counts (นับ)</option>
                <option value="uncounted">Uncounted (ไม่นับ)</option>
              </select>
            </label>
          </div>
          {submitAllMsg && <p className="mt-2 px-5 text-xs text-[var(--color-slate)]">{submitAllMsg}</p>}
        </div>
      </div>

      {problems === null && <p className="text-center text-[var(--color-slate)]">Loading...</p>}
      {problems !== null && problems.length === 0 && (
        <div className="mx-auto max-w-[720px] rounded-[40px] bg-[var(--color-lifted)] p-16 text-center">
          <EyebrowLabel>Empty</EyebrowLabel>
          <h2 className="mt-4 mb-2">No problems yet.</h2>
          <p className="mb-8 text-[var(--color-slate)]">Paste your first one from TOI to get started.</p>
          <PillButton onClick={onAdd}>Add your first problem</PillButton>
        </div>
      )}

      {problems !== null && problems.length > 0 && (
        <div className="mx-auto flex max-w-[720px] flex-col gap-4 pb-20">
          {SECTION_ORDER.map((section) => {
            const sectionProblems = sortedGrouped[section];
            if (sectionProblems.length === 0) return null;
            const points = sectionProblems.map((_, idx) => nodePoint(section, idx, sectionProblems.length));
            const height = points.at(-1)!.y + 180;
            const solved = sectionProblems.filter((p) => p.toi_best_score >= 80).length;
            return (
              <SectionBand
                key={section}
                section={section}
                title={SECTION_META[section].title}
                solved={solved}
                total={sectionProblems.length}
                milestone={SECTION_META[section].milestone(qualification)}
                height={height}
              >
                <div className="relative mx-auto" style={{ width: 600, height }}>
                  <ZigzagPath points={points} height={height} />
                  {sectionProblems.map((problem, idx) => {
                    const point = points[idx]!;
                    const status = nodeStatus(problem, qualification, openedIds);
                    const matched = filterProblem(problem, filterMode, status, normalizedQuery);
                    return (
                      <div
                        key={problem.id}
                        className="problem-node-shell"
                        style={{ left: point.x, top: point.y, "--node-delay": `${Math.min(idx * 42, 720)}ms` } as CSSProperties}
                      >
                        <ProblemNode
                          title={problem.title}
                          slug={problem.slug}
                          score={problem.toi_best_score}
                          status={status}
                          suggested={problem.id === suggestedId}
                          matched={matched}
                          size={point.diameter}
                          counts={problem.toi_counts === 1}
                          onClick={() => openProblem(problem)}
                          onToggleCounts={() => void toggleCounts(problem)}
                        />
                      </div>
                    );
                  })}
                </div>
              </SectionBand>
            );
          })}
        </div>
      )}

      {gateProblem && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--color-ink)]/25 px-6">
          <div className="w-full max-w-[440px] rounded-[32px] bg-[var(--color-lifted)] p-7 shadow-[var(--shadow-card)]">
            <p className="text-lg font-medium leading-snug">
              This section usually opens after 20 A1 problems at 80+ pts. You're at {qualification.a1Count}/20.
            </p>
            <div className="mt-7 flex justify-end gap-3">
              <PillButton variant="secondary" onClick={() => setGateProblem(null)}>Stay in A1</PillButton>
              <PillButton onClick={() => {
                sessionStorage.setItem("toizero-soft-gate-ok", "1");
                const target = gateProblem;
                setGateProblem(null);
                rememberOpen(target.id);
                navigate(`/p/${target.id}`);
              }}>
                Continue anyway
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
