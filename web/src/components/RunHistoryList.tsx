import type { RunRow } from "../lib/types";

export function RunHistoryList({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) return <div className="text-[var(--color-slate)] text-sm px-4 py-2">No runs yet.</div>;
  return (
    <ul className="space-y-1 px-2">
      {runs.map((r) => (
        <li key={r.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--color-lifted)]">
          <span className="font-medium">{r.verdict}</span>
          <span className="text-xs text-[var(--color-slate)]">{r.total_runtime_ms}ms · {new Date(r.created_at).toLocaleTimeString()}</span>
        </li>
      ))}
    </ul>
  );
}
