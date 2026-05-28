import type { CheatEntry } from "../data/cheatsheet/meta";

export function CheatSheetTOC({ entries, activeAnchor }: { entries: CheatEntry[]; activeAnchor: string | null }) {
  return (
    <nav className="motion-surface sticky top-28 h-fit max-h-[calc(100vh-8rem)] w-[260px] flex-shrink-0 self-start overflow-y-auto rounded-[32px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-5">
      <div className="mb-4 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--color-slate)]">Sections</div>
      <ul className="space-y-1.5 text-sm">
        {entries.map((entry) => (
          <li key={entry.anchor}>
            <a
              href={`#${entry.anchor}`}
              className={`cheat-toc-link block rounded-full px-3.5 py-2 font-medium ${
                activeAnchor === entry.anchor
                  ? "is-active border border-[var(--color-clay)] bg-[var(--color-selection-tint)] text-[var(--color-ink)]"
                  : "border border-transparent text-[var(--color-graphite)] hover:bg-[var(--color-selection-tint)]/60"
              }`}
            >
              {entry.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
