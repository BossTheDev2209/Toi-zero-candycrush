import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { MarkdownRender } from "./MarkdownRender";
import { PillButton } from "./PillButton";

interface AiMessage { id: number; role: "user" | "assistant"; content: string; tokens_in: number | null; tokens_out: number | null; created_at: string; }

export function AiHelpPanel({ problemId }: { problemId: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    void api.getAiStatus().then(setStatus).catch(() => setStatus(null));
    void api.getAiHistory(problemId).then((r) => setMessages(r.messages));
  }, [open, problemId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

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
      if (!res.ok) {
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

  async function clearChat() {
    await api.clearAiHistory(problemId);
    setMessages([]);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 rounded-l-[20px] border border-[var(--color-dust)] border-r-0 bg-[var(--color-lifted)] px-3 py-4 text-[var(--color-ink)] shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
        aria-label="Open AI Help"
      >
        <span className="block writing-vertical text-[12px] font-bold tracking-[0.08em] uppercase">Help</span>
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 w-[380px] max-w-[90vw] border-l border-[var(--color-dust)] bg-[var(--color-canvas)] shadow-[-12px_0_36px_rgba(0,0,0,0.08)] flex flex-col" style={{ transition: "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <div className="flex items-center justify-between border-b border-[var(--color-dust)] px-5 py-3">
        <div className="text-sm font-medium tracking-[-0.02em]">AI Help{status ? ` · ${status.provider}` : ""}</div>
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
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user"
              ? "max-w-[85%] rounded-[18px] rounded-br-md bg-[var(--color-ink)] text-[var(--color-canvas)] px-4 py-2.5 text-sm"
              : "max-w-[92%] rounded-[18px] rounded-bl-md bg-[var(--color-lifted)] border border-[var(--color-dust)] px-4 py-2.5 text-sm"}>
              {m.role === "assistant" ? <MarkdownRender>{m.content}</MarkdownRender> : m.content}
              {m.role === "assistant" && (m.tokens_in || m.tokens_out) && (
                <div className="mt-1 text-[10px] text-[var(--color-slate)]">{m.tokens_in ?? 0} in · {m.tokens_out ?? 0} out</div>
              )}
            </div>
          </div>
        ))}
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
          <PillButton onClick={() => void send(false)} disabled={busy || !draft.trim()}>{busy ? "..." : "Send"}</PillButton>
        </div>
      </div>
    </div>
  );
}
