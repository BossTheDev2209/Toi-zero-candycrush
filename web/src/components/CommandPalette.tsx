import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CHEAT_ENTRIES } from "../data/cheatsheet/meta";
import { DOC_SECTIONS } from "../lib/docsIndex";
import { fuzzyScore } from "../lib/fuzzy";
import type { Problem } from "../lib/types";

type Source = "problem" | "cheat" | "docs";
interface Entry { source: Source; label: string; sub: string; path: string; }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setCursor(0);
    void api.listProblems().then(setProblems).catch(() => setProblems([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => c + 1); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const entries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const p of problems) out.push({ source: "problem", label: `${p.slug} · ${p.title}`, sub: `${p.toi_best_score}/100`, path: `/p/${p.id}` });
    for (const c of CHEAT_ENTRIES) out.push({ source: "cheat", label: `${c.lang.toUpperCase()} · ${c.heading}`, sub: c.snippet, path: `/cheatsheet/${c.lang}#${c.anchor}` });
    for (const d of DOC_SECTIONS) out.push({ source: "docs", label: `Docs · ${d.title}`, sub: "", path: `/docs#${d.anchor}` });
    return out;
  }, [problems]);

  const filtered = useMemo(() => {
    if (!query) return entries.slice(0, 50);
    return entries
      .map((e) => ({ e, s: fuzzyScore(query, e.label) ?? Infinity }))
      .filter((x) => x.s < Infinity)
      .sort((a, b) => a.s - b.s)
      .slice(0, 50)
      .map((x) => x.e);
  }, [entries, query]);

  const selectedIdx = filtered.length === 0 ? -1 : ((cursor % filtered.length) + filtered.length) % filtered.length;

  useEffect(() => {
    if (!open || selectedIdx < 0) return;
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[data-palette-index="${selectedIdx}"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIdx, filtered.length]);

  function go(entry: Entry) {
    onClose();
    navigate(entry.path);
    setTimeout(() => {
      const hash = entry.path.split("#")[1];
      if (hash) {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    selectCurrent();
  }

  function selectCurrent() {
    const target = filtered[selectedIdx];
    if (target) go(target);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-[var(--color-ink)]/30 pt-[14vh] px-6" onClick={onClose}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-[640px] overflow-hidden rounded-[24px] border border-[var(--color-dust)] bg-[var(--color-lifted)] shadow-[var(--shadow-card)]">
        <input
          autoFocus
          role="combobox"
          aria-controls="command-palette-results"
          aria-expanded="true"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              selectCurrent();
            }
          }}
          placeholder="Search problems, cheat sheet, docs..."
          className="w-full bg-transparent px-5 py-4 text-[16px] outline-none placeholder:text-[var(--color-slate)] text-[var(--color-ink)]"
        />
        <div ref={listRef} id="command-palette-results" role="listbox" className="max-h-[60vh] overflow-y-auto border-t border-[var(--color-dust)]">
          {filtered.length === 0 && <p className="px-5 py-6 text-sm text-[var(--color-slate)]">No matches.</p>}
          {filtered.map((entry, i) => (
            <button
              key={`${entry.source}-${entry.path}-${i}`}
              type="button"
              role="option"
              data-palette-index={i}
              aria-selected={i === selectedIdx}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(entry)}
              className={`block w-full text-left px-5 py-2.5 ${i === selectedIdx ? "bg-[var(--color-canvas)]" : ""}`}
            >
              <div className="text-sm font-medium text-[var(--color-ink)]">{entry.label}</div>
              {entry.sub && <div className="text-xs text-[var(--color-slate)]">{entry.sub}</div>}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
