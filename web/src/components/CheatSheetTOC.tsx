import type { CheatEntry } from "../data/cheatsheet/meta";

export function CheatSheetTOC({ entries, activeAnchor }: { entries: CheatEntry[]; activeAnchor: string | null }) {
  return (
    <nav className="sticky top-32 w-[220px] flex-shrink-0">
      <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-3">Sections</div>
      <ul className="space-y-1.5 text-sm">
        {entries.map((entry) => (
          <li key={entry.anchor}>
            <a
              href={`#${entry.anchor}`}
              className={`cheat-toc-link block rounded-full px-3 py-1.5 ${
                activeAnchor === entry.anchor
                  ? "is-active bg-[var(--color-selection-tint)] text-[var(--color-ink)]"
                  : "text-[var(--color-graphite)] hover:bg-[var(--color-lifted)]/70"
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
