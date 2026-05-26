import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getTheme, toggleTheme, type Theme } from "../lib/theme";

export function NavPill() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  const onDocs = loc.pathname === "/docs";
  const [theme, setLocalTheme] = useState<Theme>(getTheme());
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  function flip() {
    setLocalTheme(toggleTheme());
  }

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      const currentY = window.scrollY;
      const movingDown = currentY > lastY.current + 8;
      const movingUp = currentY < lastY.current - 8;

      if (currentY < 32 || movingUp) setHidden(false);
      else if (movingDown) setHidden(true);

      lastY.current = currentY;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed top-6 left-1/2 z-40 transition-[transform,opacity] duration-300 ease-out ${
        hidden ? "-translate-x-1/2 -translate-y-24 opacity-0 pointer-events-none" : "-translate-x-1/2 translate-y-0 opacity-100"
      }`}
    >
      <nav className="bg-white rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex items-center gap-8 px-8 py-3">
        <Link to="/" className="flex items-center gap-1.5" aria-label="TOIZero home">
          <span className="w-4 h-4 rounded-full bg-[var(--color-mc-red)] -mr-1.5" />
          <span className="w-4 h-4 rounded-full bg-[var(--color-mc-yellow)] mix-blend-multiply" />
          <span className="ml-2 font-medium tracking-[-0.02em] text-[var(--color-ink)]">TOIZero</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className={`text-[16px] font-medium tracking-[-0.03em] ${
              onHome ? "text-[var(--color-ink)]" : "text-[var(--color-graphite)]"
            }`}
          >
            Problems
          </Link>
          <Link
            to="/docs"
            className={`text-[16px] font-medium tracking-[-0.03em] ${
              onDocs ? "text-[var(--color-ink)]" : "text-[var(--color-graphite)]"
            }`}
          >
            Docs
          </Link>
        </div>
        <button
          onClick={flip}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="w-9 h-9 rounded-full grid place-items-center border border-[var(--color-dust)] text-[var(--color-ink)] hover:bg-[var(--color-lifted)] transition-colors"
        >
          {theme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </nav>
    </div>
  );
}
