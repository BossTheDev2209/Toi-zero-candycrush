import { Link, useLocation } from "react-router-dom";

export function NavPill() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40">
      <nav className="bg-white rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex items-center gap-12 px-10 py-3">
        <Link to="/" className="flex items-center gap-1.5" aria-label="TOIZero home">
          <span className="w-4 h-4 rounded-full bg-[var(--color-mc-red)] -mr-1.5" />
          <span className="w-4 h-4 rounded-full bg-[var(--color-mc-yellow)] mix-blend-multiply" />
          <span className="ml-2 font-medium tracking-[-0.02em]">TOIZero</span>
        </Link>
        <div className="flex items-center gap-12">
          <Link to="/" className={`text-[16px] font-medium tracking-[-0.03em] ${onHome ? "text-[var(--color-ink)]" : "text-[var(--color-graphite)]"}`}>
            Problems
          </Link>
        </div>
      </nav>
    </div>
  );
}
