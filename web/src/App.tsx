import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { NavPill } from "./components/NavPill";
import { ProblemListPage } from "./pages/ProblemListPage";
import { ProblemEditModal } from "./pages/ProblemEditModal";
import { ProblemWorkspacePage } from "./pages/ProblemWorkspacePage";
import { DocsPage } from "./pages/DocsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CheatSheetPage } from "./pages/CheatSheetPage";
import { CommandPalette } from "./components/CommandPalette";
import { LoginGate } from "./components/LoginGate";
import { useHotkey } from "./lib/hotkey";

export default function App() {
  const [editing, setEditing] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useHotkey("ctrl+k", () => setPaletteOpen((v) => !v));

  return (
    <LoginGate>
      <div className="min-h-screen pb-24">
        <NavPill onOpenPalette={() => setPaletteOpen(true)} />
        <Routes>
          <Route
            path="/"
            element={<ProblemListPage key={refreshKey} onAdd={() => setEditing({ open: true, id: null })} />}
          />
          <Route path="/p/:id" element={<ProblemWorkspacePage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/cheatsheet/:lang" element={<CheatSheetPage />} />
          <Route path="/cheatsheet" element={<CheatSheetPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        {editing.open && (
          <ProblemEditModal
            editingId={editing.id}
            onClose={() => setEditing({ open: false, id: null })}
            onSaved={() => { setEditing({ open: false, id: null }); setRefreshKey((k) => k + 1); }}
          />
        )}
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </LoginGate>
  );
}
