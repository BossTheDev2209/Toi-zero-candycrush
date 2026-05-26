import Editor from "@monaco-editor/react";
import type { Language } from "../lib/types";

const STARTERS: Record<Language, string> = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n`,
  c:   `#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n`,
};

export function starterFor(lang: Language) { return STARTERS[lang]; }

export function CodeEditor({ language, value, onChange }: { language: Language; value: string; onChange: (v: string) => void }) {
  return (
    <Editor
      height="100%"
      language={language === "cpp" ? "cpp" : "c"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme="vs-light"
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
