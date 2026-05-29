import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { ProblemDetail, Problem, Language, JudgeResult, RunRow } from "../lib/types";
import { CodeEditor, starterFor } from "../components/CodeEditor";
import { MarkdownRender } from "../components/MarkdownRender";
import { ToolbarButton } from "../components/ToolbarButton";
import {
  IconCloudDown, IconSave, IconDownload, IconPlay, IconRunAll, IconSend,
  IconChevronLeft, IconChevronRight,
} from "../components/icons";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { TestResultsPanel } from "../components/TestResultsPanel";
import { RunHistoryList } from "../components/RunHistoryList";
import { VerdictGlossary } from "../components/VerdictGlossary";
import { ScratchTerminal } from "../components/ScratchTerminal";
import { PdfViewer } from "../components/PdfViewer";
import { AiHelpPanel } from "../components/AiHelpPanel";

export function ProblemWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [submitLink, setSubmitLink] = useState<string | null>(null);
  const [statementMode, setStatementMode] = useState<"pdf" | "markdown">("markdown");
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  // Full list, for prev/next navigation without bouncing back to the path page.
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  // Skip ไม่นับ (uncounted) problems when navigating — they don't count toward
  // qualification, so the common case is to step through counted ones only.
  // Persisted so the choice sticks across problems/sessions.
  const [skipUncounted, setSkipUncounted] = useState<boolean>(
    () => localStorage.getItem("toizero.skipUncounted") !== "false",
  );

  useEffect(() => {
    localStorage.setItem("toizero.skipUncounted", String(skipUncounted));
  }, [skipUncounted]);

  useEffect(() => {
    api.listProblems().then(setAllProblems).catch(() => { /* nav just disables */ });
  }, []);

  // Prev/next neighbors by slug order, optionally skipping uncounted problems.
  // Computed by slug comparison (not index) so it behaves even when the current
  // problem itself is uncounted and excluded from the pool.
  const { prevProblem, nextProblem } = useMemo(() => {
    if (!p || allProblems.length === 0) return { prevProblem: null, nextProblem: null };
    const pool = (skipUncounted ? allProblems.filter((x) => x.toi_counts === 1) : allProblems)
      .slice()
      .sort((a, b) => a.slug.localeCompare(b.slug));
    const next = pool.find((x) => x.slug.localeCompare(p.slug) > 0) ?? null;
    const prev = [...pool].reverse().find((x) => x.slug.localeCompare(p.slug) < 0) ?? null;
    return { prevProblem: prev, nextProblem: next };
  }, [p, allProblems, skipUncounted]);

  async function goToProblem(target: Problem | null) {
    if (!target) return;
    // Persist current edits before leaving so navigation never loses work.
    try { await api.saveSolution(pid, lang, code); } catch { /* best effort */ }
    navigate(`/p/${target.id}`);
  }

  async function importFromToi() {
    const hasCode = code.trim() && code.trim() !== starterFor(lang).trim();
    if (hasCode && !confirm("Replace the current editor contents with your latest TOI submission?")) return;
    setImporting(true); setImportMsg(null);
    try {
      const r = await api.importToiSubmission(pid);
      if (!r.ok) { setImportMsg(r.error ?? "Import failed"); return; }
      setLang(r.language);
      setCode(r.code);
      setImportMsg(`Loaded your TOI submission (${r.score}/100).`);
    } catch (e: any) {
      setImportMsg(e?.message ?? String(e));
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    // pid changes without a remount (same route element), so clear per-problem
    // transient UI from the previous problem.
    setResult(null);
    setSubmitMsg(null);
    setSubmitLink(null);
    setImportMsg(null);
    api.getProblem(pid).then(async (problem) => {
      if (cancelled) return;
      setP(problem);
      setStatementMode(problem.has_pdf ? "pdf" : "markdown");
      // Auto-fetch the PDF on first open if it's missing and the problem has
      // a TOI source URL we can pull from. Silent (no spinner, no error
      // toast) — the explicit "Download PDF" button still surfaces problems.
      // Swap to PDF view as soon as it lands so the user doesn't have to
      // re-toggle the segmented control.
      if (!problem.has_pdf && problem.source_url.includes("toi-coding.informatics.buu.ac.th")) {
        try {
          const r = await api.syncPdf(pid);
          if (cancelled) return;
          if (r.ok) {
            const next = await api.getProblem(pid);
            if (cancelled) return;
            setP(next);
            if (next.has_pdf) setStatementMode("pdf");
          }
        } catch { /* silent — manual button still works */ }
      }
    });
    api.getSolution(pid).then((s) => {
      if (cancelled) return;
      if (s) { setLang(s.language); setCode(s.code); }
      else setCode(starterFor("cpp"));
    });
    api.listRuns(pid).then((r) => { if (!cancelled) setRuns(r); });
    return () => { cancelled = true; };
  }, [pid]);

  async function save() {
    await api.saveSolution(pid, lang, code);
    setSavedMsg("Saved"); setTimeout(() => setSavedMsg(null), 1500);
  }
  function changeLanguage(next: Language) {
    setCode((current) => current === starterFor(lang) ? starterFor(next) : current);
    setLang(next);
  }
  function downloadCode() {
    if (!p) return;
    const ext: Record<Language, string> = { cpp: "cpp", c: "c", py: "py" };
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.slug}.${ext[lang]}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
    setSubmitting(true); setSubmitMsg(null); setSubmitLink(null);
    try {
      const r = await api.submitToToi(pid, lang, code);
      const submissionsUrl = p?.source_url.replace(/\/description\/?$/, "/submissions") ?? null;
      setSubmitLink(submissionsUrl);
      if (r.error) setSubmitMsg("TOI error: " + r.error);
      else setSubmitMsg("Submitted to TOI. Open the TOI submissions page to confirm the verdict.");
    } catch (e: any) { setSubmitMsg("Submit failed: " + (e.message ?? String(e))); }
    finally { setSubmitting(false); }
  }
  async function downloadPdf() {
    setPdfLoading(true); setPdfMsg(null);
    try {
      const r = await api.syncPdf(pid);
      if (!r.ok) setPdfMsg(r.error ?? "PDF sync failed");
      const next = await api.getProblem(pid);
      setP(next);
      if (next.has_pdf) {
        setStatementMode("pdf");
        setPdfMsg(`PDF cached${r.sizeKb ? ` (${r.sizeKb} KB)` : ""}`);
      }
    } catch (e: any) { setPdfMsg(e?.message ?? String(e)); }
    finally { setPdfLoading(false); }
  }

  if (!p) return <div className="pt-32 px-12">Loading…</div>;

  return (
    <div className="pt-28 px-6 max-w-[1600px] mx-auto">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link to="/" className="text-[var(--color-link)] text-sm">← Problems</Link>
        <div className="flex items-center gap-2">
          <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-xs text-[var(--color-slate)]" title="Skip ไม่นับ (uncounted) problems when moving prev/next">
            <input
              type="checkbox"
              checked={skipUncounted}
              onChange={(e) => setSkipUncounted(e.target.checked)}
              className="accent-[var(--color-ink)]"
            />
            skip ไม่นับ
          </label>
          <button
            type="button"
            onClick={() => goToProblem(prevProblem)}
            disabled={!prevProblem}
            title={prevProblem ? `${prevProblem.slug} — ${prevProblem.title}` : "No previous problem"}
            className="motion-press inline-flex items-center gap-1 rounded-full border-[1.5px] border-[var(--color-dust)] bg-transparent py-1 pl-2.5 pr-3 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-ink)] hover:bg-[var(--color-selection-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4"
          >
            <IconChevronLeft /> Prev
          </button>
          <button
            type="button"
            onClick={() => goToProblem(nextProblem)}
            disabled={!nextProblem}
            title={nextProblem ? `${nextProblem.slug} — ${nextProblem.title}` : "No next problem"}
            className="motion-press inline-flex items-center gap-1 rounded-full border-[1.5px] border-[var(--color-dust)] bg-transparent py-1 pl-3 pr-2.5 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-ink)] hover:bg-[var(--color-selection-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4"
          >
            Next <IconChevronRight />
          </button>
        </div>
      </div>
      <EyebrowLabel>{p.category}{p.toi_counts === 0 ? " · ไม่นับ" : ""}</EyebrowLabel>
      <h1 className="mt-2 mb-8">{p.slug} - {p.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="motion-surface flex max-h-[80vh] flex-col rounded-[40px] border border-[var(--color-dust)] bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div role="tablist" aria-label="Statement view" className="flex rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] p-1">
              <button
                type="button"
                role="tab"
                aria-selected={statementMode === "pdf"}
                onClick={() => setStatementMode("pdf")}
                disabled={!p.has_pdf}
                className={`motion-press rounded-full px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-lifted)] ${statementMode === "pdf" ? "bg-[var(--color-ink)] text-[var(--color-canvas)]" : "text-[var(--color-slate)] disabled:opacity-45"}`}
              >
                PDF
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statementMode === "markdown"}
                onClick={() => setStatementMode("markdown")}
                className={`motion-press rounded-full px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-lifted)] ${statementMode === "markdown" ? "bg-[var(--color-ink)] text-[var(--color-canvas)]" : "text-[var(--color-slate)]"}`}
              >
                Markdown
              </button>
            </div>
            {!p.has_pdf && p.source_url.includes("toi-coding.informatics.buu.ac.th") && (
              <button
                type="button"
                onClick={downloadPdf}
                disabled={pdfLoading}
                className="motion-press rounded-[20px] border-[1.5px] border-[var(--color-ink)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
              >
                {pdfLoading ? "Downloading..." : "Download PDF"}
              </button>
            )}
          </div>
          {pdfMsg && <div className="mb-3 text-sm text-[var(--color-slate)]">{pdfMsg}</div>}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {statementMode === "pdf" && p.has_pdf ? (
              <PdfViewer problemId={pid} />
            ) : (
              <div className="p-4">
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
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col" style={{ height: "80vh" }}>
          <div className="motion-surface flex min-h-0 flex-1 flex-col rounded-[40px] border border-[var(--color-dust)] bg-white p-4">
            {/* One left-aligned row with even rhythm: language, then the three
                action clusters (utility · run · submit) separated only by gaps
                and one divider. No justify-between, so there's no dead gulf in
                the middle and the run/submit buttons keep their breathing room. */}
            <div className="flex flex-wrap items-center gap-2 px-2 pb-3 pt-1">
              <select value={lang} onChange={(e) => changeLanguage(e.target.value as Language)} className="h-9 rounded-full border border-[var(--color-dust)] bg-white px-3 text-sm text-[var(--color-ink)]">
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="py">Python</option>
              </select>

              {/* Utility group — quiet ghost buttons, icon-led */}
              <ToolbarButton variant="ghost" icon={<IconCloudDown />} onClick={importFromToi} disabled={importing} title="Load your best existing submission from TOI">
                {importing ? "Importing…" : "Import"}
              </ToolbarButton>
              <ToolbarButton variant="ghost" icon={<IconSave />} onClick={save} title="Save solution locally">Save</ToolbarButton>
              <ToolbarButton variant="ghost" icon={<IconDownload />} onClick={downloadCode} title="Download as a source file">Download</ToolbarButton>

              <span className="mx-1 h-5 w-px bg-[var(--color-dust)]" aria-hidden="true" />

              {/* Run group — Run all stays quiet, Run samples is the primary action */}
              <ToolbarButton variant="ghost" icon={<IconRunAll />} onClick={() => run("all")} disabled={running} title="Run all local tests">Run all</ToolbarButton>
              <ToolbarButton variant="primary" icon={<IconPlay />} onClick={() => run("sample")} disabled={running}>
                {running ? "Running…" : "Run samples"}
              </ToolbarButton>

              {/* Consequential action — distinct signal color */}
              <ToolbarButton variant="send" icon={<IconSend />} onClick={submitToToi} disabled={submitting} title="Send a real submission to the TOI grader">
                {submitting ? "Submitting…" : "Submit to TOI"}
              </ToolbarButton>

              {savedMsg && <span className="ml-auto text-sm text-[var(--color-slate)]">{savedMsg}</span>}
            </div>
            <div className="flex-1 overflow-hidden rounded-[24px] border border-[var(--color-dust)]/40 min-h-0">
              <CodeEditor language={lang} value={code} onChange={setCode} />
            </div>
            {importMsg && (
              <div className="px-4 pt-3 text-sm text-[var(--color-slate)]">{importMsg}</div>
            )}
            {submitMsg && (
              <div className="px-4 pt-3 text-sm text-[var(--color-slate)]">
                {submitMsg}
                {submitLink && (
                  <>
                    {" "}
                    <a className="font-semibold text-[var(--color-link)]" href={submitLink} target="_blank" rel="noreferrer">
                      Open TOI submissions
                    </a>
                  </>
                )}
              </div>
            )}
            {result && <TestResultsPanel result={result} />}
          </div>
        </section>
      </div>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <EyebrowLabel>Recent runs</EyebrowLabel>
          <div className="motion-surface mt-3 rounded-[40px] border border-[var(--color-dust)] bg-white p-4">
            <RunHistoryList runs={runs} />
          </div>
        </div>
        <div>
          <EyebrowLabel>Terminal</EyebrowLabel>
          <div className="motion-surface mt-3 rounded-[40px] border border-[var(--color-dust)] bg-white p-5">
            <ScratchTerminal
              problemId={pid}
              language={lang}
              code={code}
              sampleInput={p.tests.samples[0]?.input_text}
            />
          </div>
        </div>
      </section>

      <section className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--color-slate)]">What verdicts mean</span>
        <VerdictGlossary compact />
      </section>
      {p && <AiHelpPanel problemId={p.id} />}
    </div>
  );
}
