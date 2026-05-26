import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { NavPill } from "./components/NavPill";
import { ProblemListPage } from "./pages/ProblemListPage";
import { ProblemEditModal } from "./pages/ProblemEditModal";

function WorkspacePlaceholder() {
  return <div className="pt-32 px-12"><h1>Workspace</h1></div>;
}

export default function App() {
  const [editing, setEditing] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen pb-24">
      <NavPill />
      <Routes>
        <Route
          path="/"
          element={<ProblemListPage key={refreshKey} onAdd={() => setEditing({ open: true, id: null })} />}
        />
        <Route path="/p/:id" element={<WorkspacePlaceholder />} />
      </Routes>
      {editing.open && (
        <ProblemEditModal
          editingId={editing.id}
          onClose={() => setEditing({ open: false, id: null })}
          onSaved={() => { setEditing({ open: false, id: null }); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
