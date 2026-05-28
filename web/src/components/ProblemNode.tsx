import type { ProblemNodeStatus } from "../lib/status";
import { scoreChipTier } from "../lib/status";

interface Props {
  title: string;
  slug: string;
  score: number;
  status: ProblemNodeStatus;
  suggested: boolean;
  matched: boolean;
  size: number;
  counts: boolean;
  onClick: () => void;
  onToggleCounts: () => void;
}

const RING: Record<ProblemNodeStatus, string> = {
  unsolved: "node-status-unsolved",
  attempted: "node-status-attempted",
  eighty: "node-status-eighty",
  perfect: "node-status-perfect",
  locked: "node-status-locked",
};

export function ProblemNode({
  title,
  slug,
  score,
  status,
  suggested,
  matched,
  size,
  counts,
  onClick,
  onToggleCounts,
}: Props) {
  // Prefer the numeric suffix from the slug (e.g. "A1-001" -> "001"). Falls back
  // to the first letter of the title for non-TOI problems without a numeric slug.
  const slugNumMatch = slug.match(/(\d+)$/);
  const label = slugNumMatch ? slugNumMatch[1] : (title.trim().charAt(0).toUpperCase() || slug.charAt(0).toUpperCase());
  // 3-digit numbers shrink slightly so they fit inside the orb at every node size.
  const labelFontSize = slugNumMatch ? Math.max(20, size * 0.26) : Math.max(28, size * 0.34);
  return (
    <div className="group relative" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={onClick}
        className={`problem-node-button rounded-full ${matched ? "" : "is-dimmed"}`}
        style={{ width: size, height: size }}
        aria-label={`Open ${slug} ${title}`}
      >
        <span className={`problem-node-orb relative flex h-full w-full items-center justify-center rounded-full ${RING[status]} ${suggested ? "is-suggested" : ""} ${!counts ? "is-uncounted" : ""}`}>
          {status === "locked" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-slate)]">
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          ) : (
            <span className="node-letter font-medium tabular-nums tracking-[-0.02em]" style={{ fontSize: labelFontSize }}>
              {label}
            </span>
          )}
          {!counts && (
            <span className="uncounted-badge absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.04em]">
              ไม่นับ
            </span>
          )}
          {status !== "locked" && (() => {
            // Replaces the previous binary check icon with the actual TOI score.
            // The chip is the score signal — tier-tinted so the eye reads
            // "trying / closing / passing / perfect" without parsing the number.
            const tier = scoreChipTier(score);
            if (!tier) return null;
            return (
              <span
                className={`score-chip score-chip-${tier}`}
                aria-label={`TOI score ${score} out of 100`}
              >
                {score}
              </span>
            );
          })()}
        </span>
      </button>
      <div className="problem-node-tip absolute left-1/2 top-full z-10 w-44 -translate-x-1/2 pt-2 text-center text-[11px] font-medium text-[var(--color-graphite)] opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="rounded-[20px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-2 shadow-[var(--shadow-nav)]">
          <div>{slug} {score > 0 ? `${score}` : ""}</div>
          <div className="mt-1 text-[10px] text-[var(--color-slate)]">
            {counts ? "นับ: counts toward qualification" : "ไม่นับ: does NOT count"}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCounts();
            }}
            className="motion-press mt-2 rounded-full border border-[var(--color-dust)] px-2.5 py-1 text-[10px] text-[var(--color-ink)]"
          >
            {counts ? "Mark uncounted" : "Mark counted"}
          </button>
        </div>
      </div>
    </div>
  );
}
