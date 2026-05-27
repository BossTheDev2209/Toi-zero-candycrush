import type { ProblemNodeStatus } from "../lib/status";

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
  const letter = title.trim().charAt(0).toUpperCase() || slug.charAt(0).toUpperCase();
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
            <span className="node-letter font-medium tracking-[-0.02em]" style={{ fontSize: Math.max(28, size * 0.34) }}>
              {letter}
            </span>
          )}
          {!counts && (
            <span className="uncounted-badge absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.04em]">
              ไม่นับ
            </span>
          )}
          {(status === "eighty" || status === "perfect") && (
            <span
              className={`absolute grid place-items-center rounded-full border border-[var(--color-success)] ${
                status === "perfect"
                  ? "h-9 w-9 bg-[var(--color-success)] text-[var(--color-canvas)]"
                  : "h-7 w-7 bg-[var(--color-white)] text-[var(--color-success)]"
              }`}
              style={{ right: -3, bottom: -3 }}
            >
              <svg width={status === "perfect" ? 18 : 14} height={status === "perfect" ? 18 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          )}
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
