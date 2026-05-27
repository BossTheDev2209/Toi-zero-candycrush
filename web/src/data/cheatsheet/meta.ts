import cppMd from "./cpp.md?raw";
import cMd from "./c.md?raw";
import pyMd from "./py.md?raw";

export const CHEATSHEET_SOURCES = { cpp: cppMd, c: cMd, py: pyMd } as const;

export type CheatLang = keyof typeof CHEATSHEET_SOURCES;

export interface CheatEntry {
  lang: CheatLang;
  heading: string;
  anchor: string;
  snippet: string;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseEntries(lang: CheatLang, md: string): CheatEntry[] {
  const out: CheatEntry[] = [];
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(/^##\s+(.+)$/);
    if (!m) continue;
    const heading = m[1]!.trim();
    let snippet = "";
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const next = lines[j]!.trim();
      if (next && !next.startsWith("#") && !next.startsWith("```")) {
        snippet = next.slice(0, 100);
        break;
      }
    }
    out.push({ lang, heading, anchor: slugify(heading), snippet });
  }
  return out;
}

export const CHEAT_ENTRIES: CheatEntry[] = [
  ...parseEntries("cpp", cppMd),
  ...parseEntries("c", cMd),
  ...parseEntries("py", pyMd),
];
