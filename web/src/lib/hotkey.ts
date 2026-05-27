import { useEffect } from "react";

export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void): void {
  useEffect(() => {
    const target = combo.toLowerCase();
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (target === "ctrl+k" && mod && key === "k") {
        e.preventDefault();
        handler(e);
      } else if (target === "escape" && key === "escape") {
        handler(e);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, handler]);
}
