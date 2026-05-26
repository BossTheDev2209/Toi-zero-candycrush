import type { ProblemNodeStatus } from "../lib/status";

interface Props {
  title: string;
  slug: string;
  score: number;
  status: ProblemNodeStatus;
  suggested: boolean;
  matched: boolean;
  size: number;
  onClick: () => void;
}

const RING: Record<ProblemNodeStatus, string> = {
  unsolved: "node-status-unsolved",
  attempted: "node-status-attempted",
  eighty: "node-status-eighty",
  perfect: "node-status-perfect",
  locked: "node-status-locked",
};

export function ProblemNode({ title, slug, score, status, suggested, matched, size, onClick }: Props) {
  const letter = title.trim().charAt(0).toUpperCase() || slug.charAt(0).toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`problem-node-button group rounded-full ${matched ? "" : "is-dimmed"}`}
      style={{ width: size, height: size }}
      aria-label={`Open ${slug} ${title}`}
    >
      <span className={`problem-node-orb relative flex h-full w-full items-center justify-center rounded-full ${RING[status]} ${suggested ? "is-suggested" : ""}`}>
        {status === "locked" ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-slate)]">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        ) : (
          <span className="node-letter font-medium tracking-[-0.02em]" style={{ fontSize: Math.max(28, size * 0.34) }}>
            {letter}
          </span>
        )}
        {(status === "eighty" || status === "perfect") && (
          <span className={`absolute grid place-items-center rounded-full bg-[var(--color-white)] text-[var(--color-ink)] ${status === "perfect" ? "h-9 w-9" : "h-7 w-7"}`} style={{ right: -3, bottom: -3 }}>
            <svg width={status === "perfect" ? 18 : 14} height={status === "perfect" ? 18 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        )}
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] w-32 -translate-x-1/2 text-center text-[11px] font-medium text-[var(--color-graphite)] opacity-0 transition-opacity group-hover:opacity-100">
        {slug} {score > 0 ? `${score}` : ""}
      </span>
    </button>
  );
}
