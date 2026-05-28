import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ScoreSyncProgress } from "../lib/types";

/**
 * Standalone "Sync from TOI" action. Lifted out of the qualification chip so
 * the action surface stays adjacent to the data it changes (the score
 * indicators on the path) without forcing the user to hover/open the chip.
 *
 * States: idle → running (progress count) → error or idle. The running pill
 * inherits the system's ink-pill button language; progress is shown as
 * "X / Y" inline rather than a separate bar (a bar would be the lazy
 * dashboard reflex and we have a small total — under 200 — that reads
 * better as a counter).
 */
export function SyncFromToiButton({ onSynced }: { onSynced: () => void }) {
  const [progress, setProgress] = useState<ScoreSyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!progress?.running) return;
    const id = window.setInterval(async () => {
      try {
        const next = await api.getScoreSyncProgress();
        setProgress(next);
        if (!next.running) {
          window.clearInterval(id);
          onSynced();
        }
      } catch (e: any) {
        setError(e?.message ?? String(e));
        window.clearInterval(id);
      }
    }, 1200);
    return () => window.clearInterval(id);
  }, [progress?.running, onSynced]);

  async function syncScores() {
    setError(null);
    try {
      setProgress(await api.startScoreSync());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  const running = Boolean(progress?.running);
  const label = running
    ? `Syncing ${progress!.done}/${progress!.total}`
    : "Sync from TOI";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={syncScores}
        disabled={running}
        aria-busy={running}
        className="motion-press inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-2 text-[13px] font-medium tracking-[-0.01em] text-[var(--color-canvas)] shadow-[var(--shadow-nav)] disabled:opacity-60"
      >
        {running && (
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span className="ai-typing-dot" style={{ background: "var(--color-canvas)" }} />
            <span className="ai-typing-dot" style={{ background: "var(--color-canvas)" }} />
            <span className="ai-typing-dot" style={{ background: "var(--color-canvas)" }} />
          </span>
        )}
        <span>{label}</span>
      </button>

      {progress && progress.failed.length > 0 && !running && (
        <span className="text-[11px] text-[var(--color-signal)]">
          {progress.failed.length} failed
        </span>
      )}
      {error && (
        <span className="text-[11px] text-[var(--color-signal)]">{error}</span>
      )}
    </div>
  );
}
