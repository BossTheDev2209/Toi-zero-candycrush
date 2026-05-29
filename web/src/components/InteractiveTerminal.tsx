import { useEffect, useRef, useState } from "react";
import type { Language } from "../lib/types";
import { ToolbarButton } from "./ToolbarButton";
import { IconPlay } from "./icons";

type ChunkKind = "out" | "err" | "sys" | "in";
interface Chunk { k: ChunkKind; t: string }
type Status = "idle" | "compiling" | "running" | "done";

/**
 * Interactive terminal: compiles the live editor code and runs it as a real,
 * long-lived process over a WebSocket. Output streams in as it's printed, and
 * you can type stdin while the program is running (Enter sends a line) — unlike
 * the old one-shot "paste input, run once" box. Stop kills it; the process also
 * dies if you close the panel.
 */
export function InteractiveTerminal({
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
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [exit, setExit] = useState<{ code: number | null; runtimeMs: number } | null>(null);
  const [stdin, setStdin] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);
  // Latest code/language without forcing a reconnect; read at Run time.
  const liveRef = useRef({ code, language });
  liveRef.current = { code, language };

  const append = (k: ChunkKind, t: string) => setChunks((prev) => {
    // Coalesce consecutive same-stream chunks so React doesn't render thousands
    // of spans for token-by-token output.
    const last = prev[prev.length - 1];
    if (last && last.k === k) return [...prev.slice(0, -1), { k, t: last.t + t }];
    return [...prev, { k, t }];
  });

  // Terminals do auto-scroll (that's expected here; the no-autoscroll rule is
  // for the AI chat). Stick to the bottom as output arrives.
  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [chunks]);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  function closeWs() {
    const ws = wsRef.current;
    wsRef.current = null;
    try { ws?.close(); } catch { /* ignore */ }
  }

  function run() {
    closeWs();
    setChunks([]);
    setExit(null);
    setStatus("compiling");

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/runs/${problemId}/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start", language: liveRef.current.language, code: liveRef.current.code }));
    };
    ws.onmessage = (e) => {
      let m: { type?: string; data?: string; code?: number | null; runtimeMs?: number };
      try { m = JSON.parse(e.data as string); } catch { return; }
      switch (m.type) {
        case "system": append("sys", (m.data ?? "") + "\n"); break;
        case "compile-error": append("err", m.data ?? ""); break;
        case "started": setStatus("running"); break;
        case "stdout": append("out", m.data ?? ""); break;
        case "stderr": append("err", m.data ?? ""); break;
        case "exit":
          setExit({ code: m.code ?? null, runtimeMs: m.runtimeMs ?? 0 });
          setStatus("done");
          closeWs();
          break;
      }
    };
    ws.onerror = () => append("sys", "(connection error)\n");
    ws.onclose = () => {
      wsRef.current = null;
      setStatus((s) => (s === "running" || s === "compiling" ? "done" : s));
    };
  }

  function stop() {
    try { wsRef.current?.send(JSON.stringify({ type: "kill" })); } catch { /* ignore */ }
    closeWs();
    setStatus("done");
  }

  function sendStdin() {
    if (status !== "running" || !wsRef.current) return;
    const line = stdin + "\n";
    try { wsRef.current.send(JSON.stringify({ type: "stdin", data: line })); } catch { return; }
    append("in", line);
    setStdin("");
  }
  function sendEof() {
    try { wsRef.current?.send(JSON.stringify({ type: "eof" })); } catch { /* ignore */ }
  }

  const running = status === "running" || status === "compiling";
  const colorFor: Record<ChunkKind, string> = {
    out: "var(--code-text)",
    err: "var(--color-signal-light)",
    sys: "var(--color-comment, var(--code-comment))",
    in: "var(--color-link)",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <button
            type="button"
            onClick={stop}
            className="motion-press inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-ink)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--color-ink)]"
          >
            Stop
          </button>
        ) : (
          <ToolbarButton variant="primary" icon={<IconPlay />} onClick={run}>Run</ToolbarButton>
        )}
        <button
          type="button"
          onClick={sendEof}
          disabled={status !== "running"}
          title="Close stdin (send EOF / Ctrl-D) so programs that read until end-of-input can finish"
          className="text-sm text-[var(--color-slate)] hover:text-[var(--color-ink)] disabled:opacity-40"
        >
          Send EOF
        </button>
        {sampleInput != null && sampleInput.trim() !== "" && (
          <button
            type="button"
            onClick={() => setStdin(sampleInput.replace(/\n+$/, ""))}
            disabled={status !== "running"}
            title="Load sample 1 into the input line"
            className="text-sm text-[var(--color-link)] underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            Fill sample 1
          </button>
        )}
        <button
          type="button"
          onClick={() => { setChunks([]); setExit(null); if (status === "done") setStatus("idle"); }}
          className="ml-auto text-sm text-[var(--color-slate)] hover:text-[var(--color-ink)]"
        >
          Clear
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-dust)]">
        <div className="flex items-center gap-3 border-b border-[var(--color-dust)] bg-[var(--color-lifted)] px-4 py-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: status === "running" ? "var(--color-success)"
                : status === "compiling" ? "var(--color-warning)"
                : exit && exit.code !== 0 ? "var(--color-danger)"
                : exit ? "var(--color-success)"
                : "var(--color-dust)",
            }}
          />
          <span className="text-sm font-medium tracking-[-0.01em]">
            {status === "compiling" ? "Compiling…"
              : status === "running" ? "Running — type below"
              : exit ? `Exit ${exit.code ?? "—"}`
              : "Ready"}
          </span>
          {exit && status === "done" && <span className="text-xs text-[var(--color-slate)]">{exit.runtimeMs} ms</span>}
        </div>

        <div ref={outRef} className="max-h-[40vh] min-h-[120px] overflow-auto bg-[var(--code-bg)] px-4 py-3">
          {chunks.length === 0 ? (
            <p className="font-mono text-[12px] text-[var(--code-comment)]">
              Press Run to compile and start your program. While it runs, type input below and press Enter.
            </p>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed">
              {chunks.map((ch, i) => (
                <span key={i} style={{ color: colorFor[ch.k], fontStyle: ch.k === "sys" ? "italic" : undefined }}>{ch.t}</span>
              ))}
            </pre>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--color-dust)] bg-[var(--color-lifted)] px-3 py-2">
          <span className="font-mono text-[12px] text-[var(--color-slate)]" aria-hidden="true">›</span>
          <input
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendStdin(); } }}
            disabled={status !== "running"}
            placeholder={status === "running" ? "type stdin, Enter to send…" : "start the program to send input"}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendStdin}
            disabled={status !== "running"}
            className="motion-press rounded-full border border-[var(--color-dust)] bg-white px-3 py-1 text-[12px] text-[var(--color-ink)] disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
