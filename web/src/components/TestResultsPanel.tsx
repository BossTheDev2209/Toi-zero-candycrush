import type { JudgeResult, Verdict } from "../lib/types";

const COLOR: Record<Verdict, string> = {
  AC: "var(--color-success)",
  WA: "var(--color-danger)",
  TLE: "var(--color-warning)",
  RE: "var(--color-danger)",
  CE: "var(--color-graphite)",
};

export function TestResultsPanel({ result }: { result: JudgeResult }) {
  return (
    <div className="motion-surface mt-4 max-h-[40vh] overflow-y-auto rounded-[24px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ background: COLOR[result.verdict] }} />
          <span className="font-medium text-lg tracking-[-0.02em]">{result.verdict}</span>
          <span className="text-[var(--color-slate)] text-sm">{result.totalRuntimeMs}ms total</span>
        </div>
      </div>

      {result.compileStderr && (
        <pre className="rounded-2xl bg-white p-4 text-[12px] whitespace-pre-wrap text-[var(--color-danger)]">{result.compileStderr}</pre>
      )}

      {result.subtaskScores && Object.keys(result.subtaskScores).length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(result.subtaskScores).map(([k, v]) => (
            <span key={k} className="rounded-full bg-white px-3 py-1 text-sm shadow-[inset_0_0_0_1px_var(--color-dust)]">
              {k}: {v.passed}/{v.total}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {result.perTest.map((t) => (
          <div key={t.idx} className="result-card rounded-2xl bg-white p-3">
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
