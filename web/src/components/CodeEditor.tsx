import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import type { Language } from "../lib/types";

const STARTERS: Record<Language, string> = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n`,
  c:   `#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n`,
};

export function starterFor(lang: Language) { return STARTERS[lang]; }

function currentTheme(): "vs-light" | "vs-dark" {
  return document.documentElement.classList.contains("dark") ? "vs-dark" : "vs-light";
}

export function CodeEditor({ language, value, onChange }: { language: Language; value: string; onChange: (v: string) => void }) {
  const [theme, setTheme] = useState<"vs-light" | "vs-dark">(currentTheme());

  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(currentTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <Editor
      height="100%"
      language={language === "cpp" ? "cpp" : "c"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme={theme}
      options={{
        fontFamily: "JetBrains Mono, Consolas, monospace",
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        insertSpaces: true,
        wordWrap: "on",
      }}
    />
  );
}
