import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { MarkdownRender } from "./MarkdownRender";
import { PillButton } from "./PillButton";

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

export function AiHelpPanel({ problemId }: { problemId: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Editing state: which user message is being edited + the in-progress draft.
  // Null = not editing. Editing one message means the others are read-only.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    void api.getAiStatus().then(setStatus).catch(() => setStatus(null));
    void api.getAiHistory(problemId).then((r) => setMessages(r.messages));
  }, [open, problemId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(force = false) {
    if (!draft.trim() || busy) return;
    setBusy(true); setError(null);
    const userMsg: AiMessage = {
      id: -1, role: "user", content: draft, tokens_in: null, tokens_out: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const message = draft;
    setDraft("");
    try {
      const res = await api.askAi({ problemId, message, forceFullSolution: force });
      // Cancellations are not errors — the user pressed Stop. Refresh history so
      // any partial assistant message the server persisted shows up.
      if (res.cancelled) {
        const fresh = await api.getAiHistory(problemId);
        setMessages(fresh.messages);
      } else if (!res.ok) {
        setError(res.error ?? "AI request failed.");
      } else {
        const fresh = await api.getAiHistory(problemId);
        setMessages(fresh.messages);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    // Server aborts the in-flight provider call. The pending askAi() then
    // resolves with cancelled:true and the finally block clears `busy`.
    try { await api.cancelAi(problemId); } catch { /* ignore — UI will recover when fetch settles */ }
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

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  /**
   * Save edit + regenerate. Two-step on the server: PATCH truncates the
   * conversation at this message; POST /regenerate produces a fresh reply.
   * UI: typing indicator covers both steps (busy stays true throughout).
   */
  async function saveEdit() {
    if (editingId === null || !editDraft.trim() || busy) return;
    const id = editingId;
    setBusy(true); setError(null);
    try {
      const patch = await api.editAiMessage(id, editDraft);
      if (!patch.ok || !patch.messages) {
        setError(patch.error ?? "Edit failed.");
        return;
      }
      // Show the truncated history immediately so the user sees the edit landed.
      setMessages(patch.messages);
      setEditingId(null);
      setEditDraft("");
      const res = await api.regenerateAi({ problemId });
      if (res.cancelled || res.ok) {
        const fresh = await api.getAiHistory(problemId);
        setMessages(fresh.messages);
      } else {
        setError(res.error ?? "Regenerate failed.");
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="ai-help-tab fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-[20px] border border-r-0 border-[var(--color-dust)] bg-[var(--color-lifted)] px-3 py-4 text-[var(--color-ink)] shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
        aria-label="Open AI Help"
      >
        <span className="block writing-vertical text-[12px] font-bold tracking-[0.08em] uppercase">Help</span>
      </button>
    );
  }

  return (
    <div className="ai-help-panel fixed bottom-0 right-0 top-0 z-40 flex w-[380px] max-w-[90vw] flex-col border-l border-[var(--color-dust)] bg-[var(--color-canvas)] shadow-[-12px_0_36px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between border-b border-[var(--color-dust)] px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-medium tracking-[-0.02em]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-info)]" />
          <span>AI Help{status ? ` · ${status.provider}` : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} title="Clear chat" className="text-[var(--color-slate)] hover:text-[var(--color-ink)] px-2 text-sm">Clear</button>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--color-slate)] hover:text-[var(--color-ink)] px-2 text-lg leading-none">×</button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && status?.hasKey && (
          <p className="text-sm text-[var(--color-slate)]">Ask for a hint about this problem. The AI sees your saved code, statement, and latest run result.</p>
        )}
        {messages.length === 0 && status && !status.hasKey && (
          <div className="rounded-2xl border border-[var(--color-dust)] bg-[var(--color-lifted)] p-4 text-sm">
            <p className="mb-2">No AI provider key configured.</p>
            <a href="/settings" className="text-[var(--color-link)] underline">Open Settings</a>
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
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-full px-3 py-1 text-[12px] text-[var(--color-slate)] hover:text-[var(--color-ink)]"
                      >
                        Cancel
                      </button>
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
                ? "max-w-[85%] rounded-[18px] rounded-br-md bg-[var(--color-ink)] text-[var(--color-canvas)] px-4 py-2.5 text-sm"
                : "max-w-[92%] rounded-[18px] rounded-bl-md bg-[var(--color-lifted)] border border-[var(--color-dust)] px-4 py-2.5 text-sm"}>
                {m.role === "assistant" && m.thinking && m.thinking.trim() && (
                  // Reason-capable models (qwen3, deepseek-r1, etc.) emit their
                  // chain-of-thought separately from the answer. Tuck it into a
                  // collapsible block — present, but not in the way.
                  <details className="ai-reasoning mb-2 -mx-1 rounded-[14px] bg-[color-mix(in_srgb,var(--color-info-soft)_50%,transparent)] border border-[var(--color-dust)] px-3 py-2 text-xs">
                    <summary className="cursor-pointer list-none flex items-center gap-2 text-[var(--color-graphite)] font-medium select-none">
                      <span aria-hidden="true" className="text-[10px]">▶</span>
                      Reasoning
                      <span className="text-[10px] text-[var(--color-slate)] font-normal">
                        ({m.thinking.length} chars)
                      </span>
                    </summary>
                    <div className="mt-2 pt-2 border-t border-[var(--color-dust)] whitespace-pre-wrap text-[var(--color-graphite)] leading-relaxed">
                      {m.thinking}
                    </div>
                  </details>
                )}
                {m.role === "assistant" ? <MarkdownRender>{m.content}</MarkdownRender> : m.content}
                {m.role === "assistant" && (() => {
                  const line = statsLine(m);
                  return line ? (
                    <div className="mt-1.5 text-[10px] text-[var(--color-slate)] font-medium tabular-nums tracking-[0.01em]">
                      {line}
                    </div>
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
        {busy && (
          <div className="ai-message flex justify-start" aria-live="polite" aria-label="Assistant is typing">
            <div className="rounded-[18px] rounded-bl-md bg-[var(--color-lifted)] border border-[var(--color-dust)] px-4 py-3 flex items-center gap-1.5">
              <span className="ai-typing-dot" />
              <span className="ai-typing-dot" />
              <span className="ai-typing-dot" />
            </div>
          </div>
        )}
        {error && <div className="rounded-2xl bg-[var(--color-lifted)] border border-[var(--color-signal)] p-3 text-xs text-[var(--color-signal)]">{error}</div>}
      </div>

      <div className="border-t border-[var(--color-dust)] px-4 py-3 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(false); } }}
          placeholder="Ask for a hint... (Ctrl+Enter to send)"
          rows={3}
          className="w-full rounded-2xl border border-[var(--color-dust)] bg-white text-[var(--color-ink)] placeholder:text-[var(--color-slate)] px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-ink)]"
        />
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => void send(true)} disabled={busy || !draft.trim()} className="text-xs text-[var(--color-slate)] hover:text-[var(--color-ink)] disabled:opacity-50">Just show me</button>
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
