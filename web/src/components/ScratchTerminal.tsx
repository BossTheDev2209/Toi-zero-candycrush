import { useState } from "react";
import { api } from "../lib/api";
import type { Language } from "../lib/types";
import { ToolbarButton } from "./ToolbarButton";
import { IconPlay } from "./icons";

type ExecResult = {
  ok: boolean;
  compileStderr?: string;
  stdout: string;
  stderr: string;
  exit: number | null;
  runtimeMs: number;
  timedOut: boolean;
};

/**
 * Scratch terminal: feed the current editor code one hand-entered stdin and see
 * the raw stdout/stderr. Unlike Run samples, nothing is graded or compared — it
 * exists for the "paste this one case from the statement and eyeball it" loop.
 * Runs the live `code`/`language` from the editor, so unsaved edits are tested.
 */
export function ScratchTerminal({
  problemId,
  language,
  code,
  sampleInput,
}: {
  problemId: number;
  language: Language;
  code: string;
  sampleInput?: string;
}) {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      setResult(await api.execCode(problemId, language, code, input));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  }

  const statusTone = result?.timedOut
    ? "var(--color-warning)"
    : result?.compileStderr
      ? "var(--color-graphite)"
      : result && result.exit !== 0
        ? "var(--color-danger)"
        : "var(--color-success)";

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void run(); }
        }}
        rows={5}
        spellCheck={false}
        placeholder="Paste one test case's input here, then Run…"
        className="w-full resize-y rounded-2xl border border-[var(--color-dust)] bg-[var(--color-bone)] px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)]"
      />

      <div className="flex flex-wrap items-center gap-3">
        <ToolbarButton variant="primary" icon={<IconPlay />} onClick={run} disabled={running}>
          {running ? "Running…" : "Run input"}
        </ToolbarButton>
        {sampleInput != null && sampleInput.trim() !== "" && (
          <button
            type="button"
            onClick={() => setInput(sampleInput)}
            className="text-sm text-[var(--color-link)] underline-offset-2 hover:underline"
          >
            Fill with sample 1
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--color-slate)]">⌘/Ctrl + Enter</span>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {result && (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-dust)]">
          <div className="flex items-center gap-3 border-b border-[var(--color-dust)] bg-[var(--color-lifted)] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusTone }} />
            <span className="text-sm font-medium tracking-[-0.01em]">
              {result.timedOut
                ? "Timed out"
                : result.compileStderr
                  ? "Compile error"
                  : `Exit ${result.exit ?? "—"}`}
            </span>
            {!result.compileStderr && (
              <span className="text-xs text-[var(--color-slate)]">{result.runtimeMs} ms</span>
            )}
          </div>

          {result.compileStderr ? (
            <pre className="max-h-[36vh] overflow-auto whitespace-pre-wrap bg-[var(--code-bg)] px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-danger)]">{result.compileStderr}</pre>
          ) : (
            <div className="max-h-[40vh] overflow-auto bg-[var(--code-bg)]">
              <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--code-text)]">
                {result.stdout || <span className="text-[var(--code-comment)]">(no output)</span>}
              </pre>
              {result.stderr && (
                <pre className="whitespace-pre-wrap border-t border-white/10 px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-signal-light)]">{result.stderr}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
