import { useEffect, useRef, useState } from "react";
import { Terminal, type WTerm } from "@wterm/react";
import "@wterm/react/css";
import type { Language } from "../lib/types";

const CR = "\r";
const CTRL_C = String.fromCharCode(3);

/**
 * A real terminal: wterm (WASM core, DOM renderer) wired to a piped system
 * shell on the server (/api/runs/:id/terminal over WebSocket). You type straight
 * into it; your editor code is saved as solution.<ext> in the shell's working
 * dir, and "Run code" compiles + runs it for you.
 *
 * A true PTY isn't usable under Bun on Windows, so the shell is piped and the
 * client does the line editing (local echo, backspace, Enter, Ctrl+C), sending
 * whole lines to the shell. Control keys are matched by char code so no raw
 * control bytes live in source.
 *
 * We drive the terminal via the `WTerm` instance handed to onReady (wterm 0.3 is
 * built for React 19 ref semantics, so the forwarded ref doesn't populate under
 * React 18 — the instance is the reliable handle).
 */
export function RealTerminal({
  problemId,
  language,
  code,
}: {
  problemId: number;
  language: Language;
  code: string;
}) {
  const wtRef = useRef<WTerm | null>(null);
  const readyRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lineRef = useRef("");
  const liveRef = useRef({ code, language });
  liveRef.current = { code, language };
  const [connected, setConnected] = useState(false);

  function out(s: string) { try { wtRef.current?.write(s); } catch { /* not ready */ } }

  function connect() {
    wsRef.current?.close();
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/runs/${problemId}/terminal`);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "start", language: liveRef.current.language, code: liveRef.current.code }));
    };
    ws.onmessage = (e) => {
      let m: { type?: string; data?: string; code?: number | null };
      try { m = JSON.parse(e.data as string); } catch { return; }
      if (m.type === "data") out(m.data ?? "");
      else if (m.type === "exit") out(`\r\n\x1b[2m[shell exited${m.code != null ? ` (${m.code})` : ""}]\x1b[0m\r\n`);
    };
    ws.onclose = () => { setConnected(false); };
    ws.onerror = () => { out("\r\n\x1b[31m[connection error]\x1b[0m\r\n"); };
  }

  function sendInput(data: string) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input", data }));
  }

  // Writes before the WASM core is ready are dropped, so connect only on ready.
  function onReady(wt: WTerm) {
    wtRef.current = wt;
    readyRef.current = true;
    connect();
  }

  useEffect(() => {
    // Reconnect a fresh shell when switching problems (if already initialised).
    if (readyRef.current) connect();
    return () => { wsRef.current?.close(); wsRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId]);

  // Local line editor: echo as you type, ship whole lines on Enter.
  function onData(d: string) {
    const code0 = d.length === 1 ? d.charCodeAt(0) : -1;
    if (d === CR) { out("\r\n"); sendInput(lineRef.current + "\n"); lineRef.current = ""; return; }
    if (code0 === 127 || code0 === 8) { // Backspace / DEL
      if (lineRef.current.length > 0) { lineRef.current = lineRef.current.slice(0, -1); out("\b \b"); }
      return;
    }
    if (code0 === 3) { out("^C\r\n"); sendInput(CTRL_C); lineRef.current = ""; return; } // Ctrl+C
    if (code0 === 27) return; // ESC / arrows / function keys
    const parts = d.split(/\r\n|\r|\n/);
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i] ?? "";
      if (seg) { lineRef.current += seg; out(seg); }
      if (i < parts.length - 1) { out("\r\n"); sendInput(lineRef.current + "\n"); lineRef.current = ""; }
    }
  }

  function runCode() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    wtRef.current?.focus();
    ws.send(JSON.stringify({ type: "run", language: liveRef.current.language, code: liveRef.current.code }));
  }
  function restart() {
    lineRef.current = "";
    out("\x1bc"); // RIS — reset/clear
    connect();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runCode}
          disabled={!connected}
          title="Compile and run the current editor code in the shell"
          className="motion-press inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[var(--color-canvas)] disabled:opacity-50"
        >
          ▸ Run code
        </button>
        <button
          type="button"
          onClick={restart}
          title="Kill the shell and start a fresh one"
          className="motion-press rounded-full border border-[var(--color-dust)] bg-white px-4 py-1.5 text-sm text-[var(--color-ink)] hover:border-[var(--color-ink)]"
        >
          Restart
        </button>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-[var(--color-slate)]">
          <span className="h-2 w-2 rounded-full" style={{ background: connected ? "var(--color-success)" : "var(--color-dust)" }} />
          {connected ? "shell ready" : "connecting…"}
        </span>
      </div>
      <Terminal
        onData={onData}
        onReady={onReady}
        wasmUrl={`${import.meta.env.BASE_URL}wterm.wasm`}
        autoResize
        cursorBlink
        theme="default"
        className="wterm-host block !w-full h-[42vh] min-h-[200px] overflow-hidden rounded-2xl border border-[var(--color-dust)] p-2"
      />
    </div>
  );
}
