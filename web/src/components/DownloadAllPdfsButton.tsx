import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { PdfSyncProgress } from "../lib/types";

/**
 * Bulk "Download all PDFs" — mirrors SyncFromToiButton's shape (idle / running
 * with X/Y counter / error). Lives on the problem list next to the score sync
 * so both bulk-fetch actions cluster together.
 *
 * Unlike the score sync, we do NOT auto-trigger this on mount. PDFs are big
 * (~250 KB each × 157 = ~40 MB) and the user should opt in explicitly. The
 * per-problem page handles its own lazy fetch via `onPdfMissing` so a user
 * who never clicks this button still gets PDFs on demand.
 */
export function DownloadAllPdfsButton({ onDownloaded }: { onDownloaded: () => void }) {
  const [progress, setProgress] = useState<PdfSyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calledOnDoneFor = useRef<string | null>(null);

  // Pick up an in-flight sync on mount (other tab, prior page nav). Same shape
  // as SyncFromToiButton — no auto-trigger though.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initial = await api.getPdfSyncProgress();
        if (cancelled) return;
        // Only attach if a run is in flight or just finished this session.
        if (initial.startedAt) setProgress(initial);
      } catch {
        // Silent — initial probe failure shouldn't shout at the user.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!progress?.running) return;
    const id = window.setInterval(async () => {
      try {
        const next = await api.getPdfSyncProgress();
        setProgress(next);
        if (!next.running) {
          window.clearInterval(id);
          // Guard against double-firing onDownloaded if the polling tick runs
          // again before React unmounts the interval (rare but possible).
          if (calledOnDoneFor.current !== next.finishedAt) {
            calledOnDoneFor.current = next.finishedAt;
            onDownloaded();
          }
        }
      } catch (e: any) {
        setError(e?.message ?? String(e));
        window.clearInterval(id);
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [progress?.running, onDownloaded]);

  async function start() {
    setError(null);
    try {
      setProgress(await api.startPdfSync());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  const running = Boolean(progress?.running);
  // Idle label varies: first run vs "everything already cached" vs "X failed"
  const idleLabel = (() => {
    if (!progress) return "Download all PDFs";
    if (progress.total === 0) return "All PDFs cached";
    if (progress.failed.length > 0) return `Retry ${progress.failed.length} failed`;
    return "Download all PDFs";
  })();
  const label = running
    ? `Downloading ${progress!.done}/${progress!.total}`
    : idleLabel;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={start}
        disabled={running}
        aria-busy={running}
        className="motion-press inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-ink)] bg-white px-5 py-2 text-[13px] font-medium tracking-[-0.01em] text-[var(--color-ink)] hover:bg-[var(--color-selection-tint)] disabled:opacity-60"
      >
        {running && (
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span className="ai-typing-dot" style={{ background: "var(--color-ink)" }} />
            <span className="ai-typing-dot" style={{ background: "var(--color-ink)" }} />
            <span className="ai-typing-dot" style={{ background: "var(--color-ink)" }} />
          </span>
        )}
        <span>{label}</span>
      </button>

      {error && (
        <span className="text-[11px] text-[var(--color-signal)]">{error}</span>
      )}
    </div>
  );
}
