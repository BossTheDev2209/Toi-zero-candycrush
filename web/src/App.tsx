import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { NavPill } from "./components/NavPill";
import { ProblemListPage } from "./pages/ProblemListPage";

function WorkspacePlaceholder() {
  return <div className="pt-32 px-12"><h1>Workspace</h1></div>;
}

export default function App() {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="min-h-screen pb-24">
      <NavPill />
      <Routes>
        <Route path="/" element={<ProblemListPage onAdd={() => setShowAdd(true)} />} />
        <Route path="/p/:id" element={<WorkspacePlaceholder />} />
      </Routes>
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-[40px] p-12 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4">Add problem</h2>
            <p className="text-[var(--color-slate)]">Form coming in Task 12.</p>
            <div className="mt-8 flex gap-3 justify-end">
              <button onClick={() => setShowAdd(false)} className="text-[var(--color-slate)]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
