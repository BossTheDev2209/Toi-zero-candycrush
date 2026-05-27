import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Qualification, ScoreSyncProgress } from "../lib/types";

export function QualificationChip({ qualification, onSynced }: { qualification: Qualification; onSynced: () => void }) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<ScoreSyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!progress?.running) return;
    const id = window.setInterval(async () => {
      const next = await api.getScoreSyncProgress();
      setProgress(next);
      if (!next.running) {
        window.clearInterval(id);
        onSynced();
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

  const dot = qualification.qualified ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]";
  const a1Bars = Math.min(4, Math.floor(qualification.a1Count / 5));
  const a2Bars = Math.min(4, Math.floor(qualification.a2a3Count / 5));

  return (
    <div
      className="fixed right-6 top-[88px] z-30"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="motion-press flex items-center gap-3 rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] px-5 py-3 text-sm font-medium text-[var(--color-ink)] shadow-[var(--shadow-nav)]"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span>{qualification.a1Count}/20 A1 · {qualification.a2a3Count}/20 A2+A3</span>
      </button>

      {open && (
        <div className="chip-popover mt-3 w-[340px] rounded-[28px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            <span>TOI Pre-Camp qualification</span>
          </div>
          <div className="mt-5 space-y-4 text-sm">
            <Meter label="A1 (80+ pts)" value={`${qualification.a1Count} / 20`} bars={a1Bars} />
            <Meter label="A2+A3 (80+ pts)" value={`${qualification.a2a3Count} / 20`} bars={a2Bars} />
          </div>
          <div className="mt-5 text-sm font-medium">Status: {qualification.qualified ? "QUALIFIED" : "NOT QUALIFIED"}</div>
          {progress && (
            <div className="mt-3 text-xs text-[var(--color-slate)]">
              Syncing {progress.done} / {progress.total}
              {progress.failed.length > 0 ? ` · ${progress.failed.length} failed` : ""}
            </div>
          )}
          {error && <div className="mt-3 text-xs text-[var(--color-signal)]">{error}</div>}
          <button
            type="button"
            onClick={syncScores}
            disabled={progress?.running}
            className="motion-press mt-5 rounded-[20px] border-[1.5px] border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-1.5 text-sm font-medium text-[var(--color-canvas)] disabled:opacity-50"
          >
            {progress?.running ? "Syncing..." : "Sync from TOI"}
          </button>
        </div>
      )}
    </div>
  );
}

function Meter({ label, value, bars }: { label: string; value: string; bars: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
      <span className="text-[var(--color-slate)]">{label}</span>
      <span className="font-medium">{value}</span>
      <span className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={`h-3 w-4 rounded-[3px] ${i < bars ? "bg-[var(--color-success)]" : "bg-[var(--color-dust)]"}`} />
        ))}
      </span>
    </div>
  );
}
