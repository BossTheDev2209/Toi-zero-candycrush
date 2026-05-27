import type { RunRow } from "../lib/types";

const VERDICT_COLOR: Record<string, string> = {
  AC: "var(--color-success)",
  WA: "var(--color-danger)",
  TLE: "var(--color-warning)",
  RE: "var(--color-danger)",
  CE: "var(--color-graphite)",
};

export function RunHistoryList({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) return <div className="text-[var(--color-slate)] text-sm px-4 py-2">No runs yet.</div>;
  return (
    <ul className="space-y-1 px-2">
      {runs.map((r) => (
        <li key={r.id} className="result-card flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[var(--color-lifted)]">
          <span className="flex items-center gap-2 font-medium">
            <span className="h-2 w-2 rounded-full" style={{ background: VERDICT_COLOR[r.verdict] ?? "var(--color-dust)" }} />
            {r.verdict}
          </span>
          <span className="text-xs text-[var(--color-slate)]">{r.total_runtime_ms}ms · {new Date(r.created_at).toLocaleTimeString()}</span>
        </li>
      ))}
    </ul>
  );
}
