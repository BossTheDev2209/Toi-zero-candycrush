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
