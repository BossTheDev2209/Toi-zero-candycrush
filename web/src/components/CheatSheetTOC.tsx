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
              className={`block rounded-md px-2 py-1 ${activeAnchor === entry.anchor ? "bg-[var(--color-lifted)] text-[var(--color-ink)]" : "text-[var(--color-graphite)] hover:bg-[var(--color-lifted)]/60"}`}
            >
              {entry.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
