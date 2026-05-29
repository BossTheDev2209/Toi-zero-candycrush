import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { MarkdownRender } from "./MarkdownRender";
import { PillButton } from "./PillButton";
import {
  IconBrain, IconGlobe, IconPopOut, IconDockRight, IconMinimize, IconChat, IconGear,
} from "./icons";

interface AiMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  tokens_in: number | null;
  tokens_out: number | null;
  thinking: string | null;
  duration_ms: number | null;
  created_at: string;
}

type PanelMode = "dock" | "float";
type Lang = "auto" | "th" | "en";

const LANG_LABEL: Record<Lang, string> = { auto: "Auto", th: "ไทย", en: "EN" };

/** localStorage-backed state — panel placement survives reloads. */
function usePersisted<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s != null ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota / privacy mode */ }
  }, [key, v]);
  return [v, setV];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/** Render the assistant metadata footer: tokens, wall time, decode rate. */
function statsLine(m: AiMessage): string | null {
  const parts: string[] = [];
  if (m.tokens_in || m.tokens_out) parts.push(`${m.tokens_in ?? 0} in · ${m.tokens_out ?? 0} out`);
  if (m.duration_ms && m.duration_ms > 0) {
    const seconds = m.duration_ms / 1000;
    parts.push(seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(1)}s`);
    if (m.tokens_out && m.tokens_out > 0) {
      const rate = Math.round((m.tokens_out / seconds) * 10) / 10;
      if (Number.isFinite(rate) && rate > 0) parts.push(`${rate} tok/s`);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Reason-capable models (qwen3, deepseek-r1, gpt-oss) emit chain-of-thought
 * separately from the answer. While streaming we show it live and expanded
 * ("real-time thinking"); once persisted it tucks into a collapsible block.
 */
function Reasoning({ text, streaming = false }: { text: string; streaming?: boolean }) {
  if (streaming) {
    return (
      <div className="ai-reasoning ai-reasoning-live mb-2 -mx-1 rounded-[14px] bg-[color-mix(in_srgb,var(--color-info-soft)_50%,transparent)] border border-[var(--color-dust)] px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-[var(--color-graphite)] font-medium">
          <span className="ai-think-pulse" aria-hidden="true" />
          Thinking…
          <span className="text-[10px] text-[var(--color-slate)] font-normal tabular-nums">({text.length} chars)</span>
        </div>
        {text.trim() && (
          <div className="mt-2 pt-2 border-t border-[var(--color-dust)] whitespace-pre-wrap text-[var(--color-graphite)] leading-relaxed max-h-48 overflow-y-auto">
            {text}
          </div>
        )}
      </div>
    );
  }
  return (
    <details className="ai-reasoning mb-2 -mx-1 rounded-[14px] bg-[color-mix(in_srgb,var(--color-info-soft)_50%,transparent)] border border-[var(--color-dust)] px-3 py-2 text-xs">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-[var(--color-graphite)] font-medium select-none">
        <span aria-hidden="true" className="text-[10px]">▶</span>
        Reasoning
        <span className="text-[10px] text-[var(--color-slate)] font-normal">({text.length} chars)</span>
      </summary>
      <div className="mt-2 pt-2 border-t border-[var(--color-dust)] whitespace-pre-wrap text-[var(--color-graphite)] leading-relaxed">
        {text}
      </div>
    </details>
  );
}

export function AiHelpPanel({ problemId }: { problemId: number }) {
  const [open, setOpen] = usePersisted("aiHelp.open", false);
  const [mode, setMode] = usePersisted<PanelMode>("aiHelp.mode", "dock");
  const [minimized, setMinimized] = usePersisted("aiHelp.min", false);
  const [pos, setPos] = usePersisted("aiHelp.pos", {
    x: typeof window !== "undefined" ? Math.max(16, window.innerWidth - 416) : 400,
    y: 84,
  });

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Live reply-in-progress (streamed). Null when idle.
  const [stream, setStream] = useState<{ thinking: string; content: string } | null>(null);
  const [status, setStatus] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Quick controls, mirrored from the server and persisted there on change.
  const [thinking, setThinking] = useState(true);
  const [language, setLanguage] = useState<Lang>("auto");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open || minimized) return;
    void api.getAiStatus().then((s) => {
      setStatus(s);
      if (typeof s.thinkingEnabled === "boolean") setThinking(s.thinkingEnabled);
      if (s.responseLanguage) setLanguage(s.responseLanguage);
    }).catch(() => setStatus(null));
    void api.getAiHistory(problemId).then((r) => setMessages(r.messages));
  }, [open, minimized, problemId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy, stream]);

  // Abort any in-flight request if the panel unmounts.
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Pull a floating window back on-screen when entering float mode — a position
  // saved on a wider monitor could otherwise leave it off the right edge.
  useEffect(() => {
    if (mode !== "float" || !open || minimized) return;
    const w = panelRef.current?.offsetWidth ?? 396;
    setPos((p) => ({
      x: clamp(p.x, 8, Math.max(8, window.innerWidth - w - 8)),
      y: clamp(p.y, 8, Math.max(8, window.innerHeight - 64)),
    }));
  }, [mode, open, minimized, setPos]);

  function appendDelta(d: { content?: string; thinking?: string }) {
    setStream((prev) => prev
      ? { thinking: prev.thinking + (d.thinking ?? ""), content: prev.content + (d.content ?? "") }
      : prev);
  }

  async function send(force = false) {
    if (!draft.trim() || busy) return;
    setBusy(true); setError(null);
    const message = draft;
    setDraft("");
    setMessages((prev) => [...prev, {
      id: -1, role: "user", content: message,
      tokens_in: null, tokens_out: null, thinking: null, duration_ms: null,
      created_at: new Date().toISOString(),
    }]);
    setStream({ thinking: "", content: "" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await api.askAiStream({ problemId, message, forceFullSolution: force }, {
        signal: ctrl.signal, onDelta: appendDelta,
      });
      if (!res.ok && !res.cancelled && res.error) setError(res.error);
      const fresh = await api.getAiHistory(problemId);
      setMessages(fresh.messages);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setStream(null); setBusy(false); abortRef.current = null;
    }
  }

  async function stop() {
    // Server aborts the in-flight provider call; the stream then emits a
    // cancelled `done` and closes gracefully, so the partial reply is captured.
    try { await api.cancelAi(problemId); } catch { /* UI recovers when the fetch settles */ }
  }

  async function clearChat() {
    await api.clearAiHistory(problemId);
    setMessages([]);
  }

  function startEdit(m: AiMessage) {
    if (busy) return;
    setEditingId(m.id);
    setEditDraft(m.content);
  }
  function cancelEdit() { setEditingId(null); setEditDraft(""); }

  async function saveEdit() {
    if (editingId === null || !editDraft.trim() || busy) return;
    const id = editingId;
    setBusy(true); setError(null);
    try {
      const patch = await api.editAiMessage(id, editDraft);
      if (!patch.ok || !patch.messages) { setError(patch.error ?? "Edit failed."); return; }
      setMessages(patch.messages);
      setEditingId(null); setEditDraft("");
      setStream({ thinking: "", content: "" });
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await api.regenerateAiStream({ problemId }, { signal: ctrl.signal, onDelta: appendDelta });
      if (!res.ok && !res.cancelled && res.error) setError(res.error);
      const fresh = await api.getAiHistory(problemId);
      setMessages(fresh.messages);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setStream(null); setBusy(false); abortRef.current = null;
    }
  }

  async function toggleThinking() {
    const next = !thinking;
    setThinking(next);
    try { await api.saveQuickAiSettings({ thinkingEnabled: next }); } catch { /* keep optimistic */ }
  }
  function cycleLanguage() {
    const order: Lang[] = ["auto", "th", "en"];
    const next = order[(order.indexOf(language) + 1) % order.length]!;
    setLanguage(next);
    void api.saveQuickAiSettings({ responseLanguage: next }).catch(() => { /* keep optimistic */ });
  }

  // ---- Drag (float mode only) ---------------------------------------------
  function onHeaderPointerDown(e: React.PointerEvent) {
    if (mode !== "float") return;
    if ((e.target as HTMLElement).closest("button, a, select, input, textarea")) return;
    e.preventDefault();
    const dx = e.clientX - pos.x;
    const dy = e.clientY - pos.y;
    const w = panelRef.current?.offsetWidth ?? 396;
    const move = (ev: PointerEvent) => {
      setPos({
        x: clamp(ev.clientX - dx, 8, window.innerWidth - w - 8),
        y: clamp(ev.clientY - dy, 8, window.innerHeight - 64),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ---- Render branches -----------------------------------------------------

  // Closed: the vertical edge tab.
  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMinimized(false); }}
        className="ai-help-tab fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-[20px] border border-r-0 border-[var(--color-dust)] bg-[var(--color-lifted)] px-3 py-4 text-[var(--color-ink)] shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
        aria-label="Open AI Help"
      >
        <span className="block writing-vertical text-[12px] font-bold tracking-[0.08em] uppercase">Help</span>
      </button>
    );
  }

  // Minimized: floating bubble launcher.
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="ai-help-bubble fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-dust)] bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
        aria-label="Restore AI Help"
        title={status ? `AI Help · ${status.provider}` : "AI Help"}
      >
        <IconChat className="h-[22px] w-[22px]" />
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[var(--color-info)] ring-2 ring-[var(--color-ink)]" />
      </button>
    );
  }

  const shellClass = mode === "dock"
    ? "ai-help-panel fixed bottom-0 right-0 top-0 z-40 flex w-[380px] max-w-[90vw] flex-col border-l border-[var(--color-dust)] bg-[var(--color-canvas)] shadow-[-12px_0_36px_rgba(0,0,0,0.08)]"
    : "ai-help-panel ai-help-float fixed z-40 flex w-[396px] max-w-[92vw] flex-col overflow-hidden rounded-[20px] border border-[var(--color-dust)] bg-[var(--color-canvas)] shadow-[0_28px_70px_rgba(0,0,0,0.22)]";
  const shellStyle = mode === "float"
    ? { left: pos.x, top: pos.y, height: "min(78vh, 680px)" }
    : undefined;

  const chip = "motion-press inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium";

  return (
    <div ref={panelRef} className={shellClass} style={shellStyle}>
      {/* Title bar — drag handle in float mode. */}
      <div
        onPointerDown={onHeaderPointerDown}
        className={`flex items-center justify-between border-b border-[var(--color-dust)] px-4 py-2.5 ${mode === "float" ? "cursor-grab active:cursor-grabbing select-none" : ""}`}
      >
        <div className="flex items-center gap-2 text-sm font-medium tracking-[-0.02em]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-info)]" />
          <span>AI Help{status ? ` · ${status.provider}` : ""}</span>
        </div>
        <div className="flex items-center gap-0.5 text-[var(--color-slate)]">
          <button
            onClick={() => setMode(mode === "dock" ? "float" : "dock")}
            title={mode === "dock" ? "Pop out into a floating window" : "Dock to the right edge"}
            aria-label={mode === "dock" ? "Pop out" : "Dock"}
            className="motion-press rounded-full p-1.5 hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]"
          >
            {mode === "dock" ? <IconPopOut className="h-4 w-4" /> : <IconDockRight className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMinimized(true)}
            title="Minimize to a bubble"
            aria-label="Minimize"
            className="motion-press rounded-full p-1.5 hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]"
          >
            <IconMinimize className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            title="Close"
            className="motion-press rounded-full px-2 text-lg leading-none hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]"
          >
            ×
          </button>
        </div>
      </div>

      {/* Quick controls: thinking + reply language + settings. */}
      <div className="flex items-center gap-2 border-b border-[var(--color-dust)] px-4 py-2">
        <button
          onClick={() => void toggleThinking()}
          title={thinking ? "Reasoning on — models show their thinking. Click to turn off." : "Reasoning off — faster, no thinking trace. Click to turn on."}
          aria-pressed={thinking}
          className={`${chip} ${thinking
            ? "border-[color-mix(in_srgb,var(--color-info)_45%,var(--color-dust))] bg-[color-mix(in_srgb,var(--color-info-soft)_70%,transparent)] text-[var(--color-info)]"
            : "border-[var(--color-dust)] bg-transparent text-[var(--color-slate)]"}`}
        >
          <IconBrain className="h-3.5 w-3.5" />
          Thinking {thinking ? "on" : "off"}
        </button>
        <button
          onClick={cycleLanguage}
          title="Reply language — Auto mirrors your question; ไทย forces Thai; EN forces English."
          className={`${chip} border-[var(--color-dust)] text-[var(--color-graphite)] hover:text-[var(--color-ink)] hover:border-[var(--color-slate)]`}
        >
          <IconGlobe className="h-3.5 w-3.5" />
          {LANG_LABEL[language]}
        </button>
        <a
          href="/settings#ai-settings"
          title="AI settings (model, context length, persona)"
          aria-label="AI settings"
          className="motion-press ml-auto rounded-full p-1.5 text-[var(--color-slate)] hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]"
        >
          <IconGear className="h-4 w-4" />
        </a>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && !stream && status?.hasKey && (
          <p className="text-sm text-[var(--color-slate)]">Ask for a hint about this problem. The AI sees your saved code, statement, and latest run result.</p>
        )}
        {messages.length === 0 && !stream && status && !status.hasKey && (
          <div className="rounded-2xl border border-[var(--color-dust)] bg-[var(--color-lifted)] p-4 text-sm">
            <p className="mb-2">No AI provider key configured.</p>
            <a href="/settings#ai-settings" className="text-[var(--color-link)] underline">Open Settings</a>
          </div>
        )}
        {messages.map((m) => {
          const isEditing = editingId === m.id;
          if (m.role === "user" && isEditing) {
            return (
              <div key={m.id} className="ai-message flex justify-end">
                <div className="ai-edit-shell w-[94%] rounded-[18px] rounded-br-md bg-[var(--color-lifted)] border border-[var(--color-dust)] px-4 py-3">
                  <textarea
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void saveEdit(); }
                      if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                    }}
                    rows={Math.min(8, Math.max(2, editDraft.split("\n").length))}
                    className="w-full resize-none bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-slate)] text-sm leading-relaxed focus:outline-none focus-visible:outline-none"
                    style={{ outline: "none" }}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-dust)] pt-2.5">
                    <span className="text-[11px] text-[var(--color-slate)]">Truncates the reply below.</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={cancelEdit} className="rounded-full px-3 py-1 text-[12px] text-[var(--color-slate)] hover:text-[var(--color-ink)]">Cancel</button>
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        disabled={!editDraft.trim() || busy}
                        className="motion-press inline-flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] px-3.5 py-1 text-[12px] font-medium tracking-[-0.01em] disabled:opacity-50"
                        aria-label="Resend edited message"
                      >
                        Resend
                        <span className="text-[10px] opacity-70" aria-hidden="true">⌘↵</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`ai-message group relative ${m.role === "user" ? "flex justify-end" : "flex justify-start"}`}>
              <div className={m.role === "user"
                ? "max-w-[85%] rounded-[18px] rounded-br-md bg-[var(--color-ink)] text-[var(--color-canvas)] px-4 py-2.5 text-sm whitespace-pre-wrap"
                : "max-w-[92%] rounded-[18px] rounded-bl-md bg-[var(--color-lifted)] border border-[var(--color-dust)] px-4 py-2.5 text-sm"}>
                {m.role === "assistant" && m.thinking && m.thinking.trim() && <Reasoning text={m.thinking} />}
                {m.role === "assistant" ? <MarkdownRender>{m.content}</MarkdownRender> : m.content}
                {m.role === "assistant" && (() => {
                  const line = statsLine(m);
                  return line ? (
                    <div className="mt-1.5 text-[10px] text-[var(--color-slate)] font-medium tabular-nums tracking-[0.01em]">{line}</div>
                  ) : null;
                })()}
              </div>
              {m.role === "user" && m.id > 0 && (
                <button
                  onClick={() => startEdit(m)}
                  disabled={busy}
                  title="Edit and resend"
                  aria-label="Edit message"
                  className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded-full bg-[var(--color-lifted)] border border-[var(--color-dust)] p-1.5 text-[var(--color-slate)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        {/* Live streaming reply. */}
        {stream && (
          <div className="ai-message flex justify-start" aria-live="polite">
            <div className="max-w-[92%] rounded-[18px] rounded-bl-md bg-[var(--color-lifted)] border border-[var(--color-dust)] px-4 py-2.5 text-sm">
              {stream.thinking.trim() && <Reasoning text={stream.thinking} streaming />}
              {stream.content
                ? <MarkdownRender>{stream.content}</MarkdownRender>
                : (!stream.thinking.trim() && (
                  <span className="inline-flex items-center gap-1.5" aria-label="Assistant is typing">
                    <span className="ai-typing-dot" /><span className="ai-typing-dot" /><span className="ai-typing-dot" />
                  </span>
                ))}
              {(stream.content || stream.thinking) && <span className="ai-stream-caret" aria-hidden="true" />}
            </div>
          </div>
        )}

        {/* Pre-stream / edit-truncate spinner (no deltas yet). */}
        {busy && !stream && (
          <div className="ai-message flex justify-start" aria-live="polite" aria-label="Assistant is typing">
            <div className="rounded-[18px] rounded-bl-md bg-[var(--color-lifted)] border border-[var(--color-dust)] px-4 py-3 flex items-center gap-1.5">
              <span className="ai-typing-dot" /><span className="ai-typing-dot" /><span className="ai-typing-dot" />
            </div>
          </div>
        )}

        {error && <div className="rounded-2xl bg-[var(--color-lifted)] border border-[var(--color-signal)] p-3 text-xs text-[var(--color-signal)]">{error}</div>}
      </div>

      <div className="border-t border-[var(--color-dust)] px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <button onClick={clearChat} title="Clear chat" className="text-xs text-[var(--color-slate)] hover:text-[var(--color-ink)]">Clear chat</button>
          <button onClick={() => void send(true)} disabled={busy || !draft.trim()} className="text-xs text-[var(--color-slate)] hover:text-[var(--color-ink)] disabled:opacity-50">Just show me</button>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(false); } }}
          placeholder="Ask for a hint... (Ctrl+Enter to send)"
          rows={3}
          className="w-full rounded-2xl border border-[var(--color-dust)] bg-white text-[var(--color-ink)] placeholder:text-[var(--color-slate)] px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-ink)]"
        />
        <div className="flex items-center justify-end gap-2">
          {busy ? (
            <PillButton variant="secondary" onClick={() => void stop()} title="Stop generating and free RAM (Ollama)">Stop</PillButton>
          ) : (
            <PillButton onClick={() => void send(false)} disabled={!draft.trim()}>Send</PillButton>
          )}
        </div>
      </div>
    </div>
  );
}
