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
