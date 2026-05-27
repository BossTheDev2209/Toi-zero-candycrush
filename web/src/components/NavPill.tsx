import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getTheme, toggleTheme, type Theme } from "../lib/theme";

function navLinkClass(active: boolean): string {
  return `nav-link text-[16px] font-medium tracking-[-0.03em] ${
    active ? "is-active text-[var(--color-ink)]" : "text-[var(--color-graphite)]"
  }`;
}

export function NavPill({ onOpenPalette }: { onOpenPalette?: () => void } = {}) {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  const onDocs = loc.pathname === "/docs";
  const onCheat = loc.pathname.startsWith("/cheatsheet");
  const onSettings = loc.pathname === "/settings";
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
      className={`nav-auto-hide fixed top-6 left-1/2 z-40 ${
        hidden ? "is-hidden pointer-events-none" : ""
      }`}
    >
      <nav className="nav-shell flex items-center gap-8 rounded-full bg-white px-8 py-3 shadow-[var(--shadow-nav)]">
        <Link to="/" className="flex items-center gap-1.5" aria-label="TOIZero home">
          <span className="w-4 h-4 rounded-full bg-[var(--color-mc-red)] -mr-1.5" />
          <span className="w-4 h-4 rounded-full bg-[var(--color-mc-yellow)] mix-blend-multiply" />
          <span className="ml-2 font-medium tracking-[-0.02em] text-[var(--color-ink)]">TOIZero</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className={navLinkClass(onHome)}
          >
            Problems
          </Link>
          <Link
            to="/docs"
            className={navLinkClass(onDocs)}
          >
            Docs
          </Link>
          <Link
            to="/cheatsheet/cpp"
            className={navLinkClass(onCheat)}
          >
            Cheat sheet
          </Link>
          <Link
            to="/settings"
            className={navLinkClass(onSettings)}
          >
            Settings
          </Link>
        </div>
        <button
          onClick={onOpenPalette}
          aria-label="Open command palette"
          title="Ctrl+K"
          className="motion-press grid h-9 w-9 place-items-center rounded-full border border-[var(--color-dust)] text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-selection-tint)]"
        >
          ⌘K
        </button>
        <button
          onClick={flip}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="motion-press grid h-9 w-9 place-items-center rounded-full border border-[var(--color-dust)] text-[var(--color-ink)] hover:bg-[var(--color-selection-tint)]"
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
