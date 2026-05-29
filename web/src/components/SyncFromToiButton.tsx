import { useEffect, useRef, useState } from "react";
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
 *
 * Auto-sync on mount: when the page loads we GET /sync-progress once. If a
 * sync is already running (e.g. started in another tab) we just attach to it
 * and start polling. Otherwise, if the DB's last sync is older than
 * AUTO_SYNC_STALE_MS (or never), we silently kick off a fresh sync — this is
 * the "always show fresh scores" behavior. The throttle key is the
 * server-side MAX(toi_last_sync_at), not localStorage, so opening the page in
 * a second browser doesn't double-sync.
 */
const AUTO_SYNC_STALE_MS = 60 * 60 * 1000; // 1 hour

function isStale(lastSyncAt: string | null): boolean {
  if (!lastSyncAt) return true;
  const t = Date.parse(lastSyncAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > AUTO_SYNC_STALE_MS;
}

export function SyncFromToiButton({ onSynced }: { onSynced: () => void }) {
  const [progress, setProgress] = useState<ScoreSyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track which lastSyncAt we've already auto-triggered against — guards against
  // double-firing if React StrictMode mounts the component twice in dev. We use
  // a ref so it doesn't drive renders.
  const autoTriggeredFor = useRef<string | null>(null);

  // Mount: pick up an in-flight sync, or auto-trigger a stale one. Runs once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initial = await api.getScoreSyncProgress();
        if (cancelled) return;
        setProgress(initial);
        // Already syncing in another tab / leftover from a prior page — just attach.
        if (initial.running) return;
        // Auto-sync if stale, but only once per distinct lastSyncAt sentinel so
        // remounts in StrictMode don't re-fire.
        const sentinel = initial.lastSyncAt ?? "never";
        if (isStale(initial.lastSyncAt) && autoTriggeredFor.current !== sentinel) {
          autoTriggeredFor.current = sentinel;
          try {
            const started = await api.startScoreSync();
            if (!cancelled) setProgress(started);
          } catch {
            // Silent — auto-sync failures shouldn't shout at the user. The
            // explicit button click path still surfaces errors.
          }
        }
      } catch {
        // Same — silent on initial probe failure.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Polling loop: only active while a sync is running. Picks up done/total
  // updates and calls onSynced() once when the run finishes.
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
