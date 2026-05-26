import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Problem } from "../lib/types";
import { ProblemCircle } from "../components/ProblemCircle";
import { PillButton } from "../components/PillButton";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { OrbitalArc } from "../components/OrbitalArc";

export function ProblemListPage({ onAdd }: { onAdd: () => void }) {
  const [problems, setProblems] = useState<Problem[] | null>(null);

  useEffect(() => {
    api.listProblems().then(setProblems);
  }, []);

  return (
    <div className="pt-32 px-12 max-w-[1280px] mx-auto">
      <div className="mb-4"><EyebrowLabel>Library</EyebrowLabel></div>
      <div className="flex items-end justify-between mb-16">
        <h1 className="max-w-3xl">Problems for your TOI Zero prep.</h1>
        <PillButton onClick={onAdd}>Add problem</PillButton>
      </div>

      {problems === null && <p className="text-[var(--color-slate)]">Loading…</p>}
      {problems !== null && problems.length === 0 && (
        <div className="rounded-[40px] bg-[var(--color-lifted)] p-16 text-center">
          <EyebrowLabel>Empty</EyebrowLabel>
          <h2 className="mt-4 mb-2">No problems yet.</h2>
          <p className="text-[var(--color-slate)] mb-8">Paste your first one from TOI to get started.</p>
          <PillButton onClick={onAdd}>Add your first problem</PillButton>
        </div>
      )}

      {problems !== null && problems.length > 0 && (
        <div className="relative">
          <div className="absolute -top-8 left-12 opacity-50 pointer-events-none">
            <OrbitalArc width={520} height={120} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-24 gap-x-12 pt-12">
            {problems.map((p, i) => (
              <div key={p.id} className={i % 2 === 0 ? "md:translate-y-12" : ""}>
                <Link to={`/p/${p.id}`}>
                  <ProblemCircle title={p.title} category={p.category} status="unsolved" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
