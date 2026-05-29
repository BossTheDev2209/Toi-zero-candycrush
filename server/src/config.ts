import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
    py?: { bin: string; flags: string[] };
  };
  toi: {
    baseUrl: string;
    cookie: string;
    xsrf: string;
    extraHeaders: Record<string, string>;
    /** Optional stored credentials for auto-refreshing the cookie. Plaintext, gitignored. */
    username?: string;
    password?: string;
    lastLoginAt?: string;
    /** Deprecated: prefer baseUrl. Kept for back-compat with older settings.json. */
    submitUrl?: string;
  };
  ai: {
    provider: "anthropic" | "openai" | "ollama" | "claude-cli";
    anthropicApiKey?: string;
    anthropicModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
    /**
     * Ollama keep_alive value passed with every /api/chat request. Controls how
     * long the model stays loaded in RAM after a reply completes.
     *
     * Accepts Ollama's formats: "0" / 0 → unload immediately (frees RAM, slower
     * next request), "5m" → 5-minute idle, "-1" → keep loaded forever.
     * Default in this project is "0" so the model doesn't squat on RAM after AI
     * Help replies, which was a real complaint on a 16 GB box.
     */
    ollamaKeepAlive?: string;
    /** Model name passed to `claude --print --model <m>`. e.g. "sonnet", "opus", "claude-sonnet-4-5". */
    claudeCliModel?: string;
    maxTokens?: number;
    /**
     * Whether to ask reason-capable models to emit their chain-of-thought.
     * Drives Ollama's `think` flag. Default true. Turn off to skip reasoning
     * entirely (faster first token, no "Reasoning" block).
     */
    thinkingEnabled?: boolean;
    /**
     * Language the tutor should reply in. "auto" mirrors the student's question
     * language (default); "th" forces Thai; "en" forces English. Injected into
     * the system prompt.
     */
    responseLanguage?: "auto" | "th" | "en";
    /**
     * Ollama context window in tokens (`options.num_ctx`). Larger = more of the
     * conversation/code the model can see, at the cost of RAM. Undefined leaves
     * Ollama's per-model default. Typical values: 4096–32768 on consumer GPUs.
     */
    ollamaNumCtx?: number;
    /** Free-form student bio. Injected into the system prompt so the tutor adapts. */
    userProfile?: string;
    /** Free-form style preferences (language mix, hint depth, etc). Injected verbatim. */
    tutorStyle?: string;
  };
  /** @internal — populated by loadConfig, used by writers. Not present in JSON. */
  _root?: string;
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

/**
 * Update specific TOI fields and write them back to settings.json.
 * Only touches the requested keys; never echoes the password in logs.
 * Mutates the passed cfg in place so future calls see the refreshed values.
 */
export function persistToiUpdate(cfg: AppConfig, patch: Partial<AppConfig["toi"]>): void {
  const root = cfg._root ?? process.cwd();
  const path = join(root, "settings.json");
  if (!existsSync(path)) throw new Error("settings.json not found at " + path);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.toi = { ...(raw.toi ?? {}), ...patch };
  writeFileSync(path, JSON.stringify(raw, null, 2) + "\n", "utf8");
  cfg.toi = { ...cfg.toi, ...patch };
}

export function persistAiUpdate(cfg: AppConfig, patch: Partial<AppConfig["ai"]>): void {
  const root = cfg._root ?? process.cwd();
  const path = join(root, "settings.json");
  if (!existsSync(path)) throw new Error("settings.json not found at " + path);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.ai = { ...(raw.ai ?? {}), ...patch };
  writeFileSync(path, JSON.stringify(raw, null, 2) + "\n", "utf8");
  cfg.ai = { ...cfg.ai, ...patch };
}
