import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface AppConfig {
  dataDir: string;
  dbPath: string;
  problemsDir: string;
  port: number;
  apiPort: number;
  compiler: {
    c:   { bin: string; flags: string[] };
    cpp: { bin: string; flags: string[] };
  };
  toi: {
    baseUrl: string;
    cookie: string;
    xsrf: string;
    extraHeaders: Record<string, string>;
    /** Deprecated: prefer baseUrl. Kept for back-compat with older settings.json. */
    submitUrl?: string;
  };
}

// Walk up from start dir looking for settings.example.json (project root marker).
function findRoot(start: string): string {
  let cur = resolve(start);
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(cur, "settings.example.json"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return start;
}

export function loadConfig(start = process.cwd()): AppConfig {
  const root = findRoot(start);
  const local = join(root, "settings.json");
  const example = join(root, "settings.example.json");
  const path = existsSync(local) ? local : example;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return { ...raw, _root: root } as AppConfig;
}
