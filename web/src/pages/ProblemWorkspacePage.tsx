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
import { VerdictGlossary } from "../components/VerdictGlossary";
import { PdfViewer } from "../components/PdfViewer";

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
  const [statementMode, setStatementMode] = useState<"pdf" | "markdown">("markdown");
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    api.getProblem(pid).then((problem) => {
      setP(problem);
      setStatementMode(problem.has_pdf ? "pdf" : "markdown");
    });
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
      <div className="mb-2"><Link to="/" className="text-[var(--color-link)] text-sm">← Problems</Link></div>
      <EyebrowLabel>{p.category}</EyebrowLabel>
      <h1 className="mt-2 mb-8">{p.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="flex max-h-[80vh] flex-col rounded-[40px] bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] p-1">
              <button
                type="button"
                onClick={() => setStatementMode("pdf")}
                disabled={!p.has_pdf}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${statementMode === "pdf" ? "bg-[var(--color-ink)] text-[var(--color-canvas)]" : "text-[var(--color-slate)] disabled:opacity-45"}`}
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => setStatementMode("markdown")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${statementMode === "markdown" ? "bg-[var(--color-ink)] text-[var(--color-canvas)]" : "text-[var(--color-slate)]"}`}
              >
                Markdown
              </button>
            </div>
            {!p.has_pdf && p.source_url.includes("toi-coding.informatics.buu.ac.th") && (
              <button
                type="button"
                onClick={downloadPdf}
                disabled={pdfLoading}
                className="rounded-[20px] border-[1.5px] border-[var(--color-ink)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
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

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <EyebrowLabel>Recent runs</EyebrowLabel>
          <div className="mt-3 bg-white rounded-[40px] p-4">
            <RunHistoryList runs={runs} />
          </div>
        </div>
        <div>
          <EyebrowLabel>What verdicts mean</EyebrowLabel>
          <div className="mt-3">
            <VerdictGlossary />
          </div>
        </div>
      </section>
    </div>
  );
}
