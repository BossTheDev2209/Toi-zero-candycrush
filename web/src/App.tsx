import { Routes, Route } from "react-router-dom";
import { NavPill } from "./components/NavPill";

function Placeholder({ title }: { title: string }) {
  return <div className="pt-32 px-12"><h1>{title}</h1><p className="mt-6 max-w-prose">Stub — wiring in next task.</p></div>;
}

export default function App() {
  return (
    <div className="min-h-screen pb-24">
      <NavPill />
      <Routes>
        <Route path="/" element={<Placeholder title="Problems" />} />
        <Route path="/p/:id" element={<Placeholder title="Problem Workspace" />} />
      </Routes>
    </div>
  );
}
