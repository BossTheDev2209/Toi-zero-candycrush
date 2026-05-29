import { useEffect, useState } from "react";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { PillButton } from "../components/PillButton";
import { api } from "../lib/api";

interface AuthStatus {
  hasCredentials: boolean;
  username: string | null;
  lastLoginAt: string | null;
  baseUrl: string;
}

export function SettingsPage() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const r = await fetch("/api/toi/auth-status");
      const data: AuthStatus = await r.json();
      setStatus(data);
      if (data.username && !username) setUsername(data.username);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => { void loadStatus(); }, []);

  async function save() {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const res = await fetch("/api/toi/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.ok) setMsg("Saved and logged in.");
      else setErr(data.error ?? "Save failed.");
      setPassword(""); // Clear from memory after save attempt
      await loadStatus();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function reloginNow() {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const res = await fetch("/api/toi/login", { method: "POST" });
      const data = await res.json();
      if (data.ok) setMsg("Logged in.");
      else setErr(data.error ?? "Login failed.");
      await loadStatus();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[640px] px-6 pt-32 pb-20">
      <div className="mb-4"><EyebrowLabel>Settings</EyebrowLabel></div>
      <h1 className="mb-8">TOI account.</h1>

      <section className="motion-surface rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-8">
        <div className="mb-4 text-sm text-[var(--color-slate)]">
          <p>Stored locally in <code className="font-mono text-[12px]">settings.json</code> (gitignored). Used only to refresh your TOI session cookie when it expires.</p>
          <p className="mt-2"><strong>Never shared</strong>: credentials stay on this machine. Files are not committed to git.</p>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-1.5">TOI username</div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="your TOI username"
              className="w-full rounded-2xl border border-[var(--color-dust)] bg-white px-4 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)]"
            />
          </label>
          <label className="block">
            <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-1.5">TOI password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={status?.hasCredentials ? "leave blank to keep existing" : "your TOI password"}
              className="w-full rounded-2xl border border-[var(--color-dust)] bg-white px-4 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)] font-mono"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <PillButton onClick={save} disabled={saving || !username || !password}>
              {saving ? "Saving…" : "Save and re-login"}
            </PillButton>
            {status?.hasCredentials && (
              <PillButton variant="secondary" onClick={reloginNow} disabled={saving}>
                {saving ? "Working…" : "Re-login now"}
              </PillButton>
            )}
          </div>

          {msg && <div className="mt-3 text-sm text-[var(--color-success)]">{msg}</div>}
          {err && <div className="mt-3 text-sm text-[var(--color-danger)]">{err}</div>}
        </div>
      </section>

      <section className="motion-surface mt-8 rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-8 text-sm">
        <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-3">Status</div>
        {status === null ? (
          <p className="text-[var(--color-slate)]">Loading…</p>
        ) : (
          <ul className="space-y-1.5 text-[var(--color-ink)]">
            <li>Base URL: <span className="font-mono text-[12px] text-[var(--color-graphite)]">{status.baseUrl || "(not set)"}</span></li>
            <li>Username: <span className="font-mono text-[12px] text-[var(--color-graphite)]">{status.username ?? "(not stored)"}</span></li>
            <li>Last login: <span className="font-mono text-[12px] text-[var(--color-graphite)]">{status.lastLoginAt ?? "(never)"}</span></li>
          </ul>
        )}
        <p className="mt-4 text-xs text-[var(--color-slate)]">
          When the session cookie expires (TOI rotates daily-ish), the server auto-refreshes it on the next sync if credentials are stored. No manual cookie pasting needed.
        </p>
      </section>

      <section className="motion-surface mt-8 rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-8 text-sm">
        <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-3">
          Counts (นับ / ไม่นับ) — bookmarklet
        </div>
        <CountsBookmarklet />
      </section>

      <section id="ai-settings" className="motion-surface mt-8 scroll-mt-28 rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-8">
        <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-3">AI assistant</div>
        <AiSettings />
      </section>
    </div>
  );
}

/**
 * TOI's overview page doesn't include the นับคะแนน column in the server-rendered
 * HTML — the column is injected client-side (you have a Chrome extension that
 * does this). That means `/api/toi/sync-counts` can't fetch it from the server
 * cookie alone; the data only exists in your browser's DOM.
 *
 * Workaround: a bookmarklet. Drag the link below to your bookmarks bar, then
 * open the TOI overview tab and click the bookmark. It reads the rendered DOM,
 * POSTs `{slug: 0|1}` to `/api/toi/counts-bulk`, and surfaces a count summary
 * via alert(). One click = full counts re-sync. No console needed.
 *
 * The JS is intentionally tiny: just enough to walk rows, match the slug shape
 * from <th>, and look for "นับ" or "ไม่นับ" anywhere in the row's cells. The
 * server endpoint is already CORS-permissive (origin "*"), so cross-origin
 * fetch from toi-coding.informatics.buu.ac.th to localhost:8787 works.
 */
function CountsBookmarklet() {
  const code =
    `(async()=>{const rs=[...document.querySelectorAll('table tbody tr')];const c={};for(const r of rs){const t=r.querySelector('th');if(!t)continue;const s=t.textContent.trim();if(!/^[A-Z]\\d+-\\d+$/.test(s))continue;const cs=[...r.children].map(x=>x.textContent.trim());if(cs.includes('ไม่นับ'))c[s]=0;else if(cs.includes('นับ'))c[s]=1;}try{const r=await fetch('http://localhost:8787/api/toi/counts-bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({counts:c})});const j=await r.json();alert('TOI counts synced: '+(j.seen||0)+' problems ('+(j.uncounted||0)+' ไม่นับ)');}catch(e){alert('Sync failed: '+(e&&e.message||e));}})();`;
  const href = `javascript:${code}`;

  return (
    <div className="space-y-3 text-[var(--color-ink)]">
      <p>
        Your TOI contest hides the <code className="font-mono text-[12px]">นับ/ไม่นับ</code> column from the server HTML — only your browser sees it.
        Drag this link to your bookmarks bar, then click it from the TOI overview tab to sync the counts here:
      </p>
      <div>
        {/* Drag-to-bookmarks pattern. href= javascript: makes it executable when */}
        {/* invoked from a bookmark; preventDefault on click keeps the in-app click */}
        {/* from blowing away the current page. */}
        <a
          href={href}
          onClick={(e) => e.preventDefault()}
          draggable
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-2 text-[13px] font-medium text-[var(--color-canvas)] no-underline cursor-grab active:cursor-grabbing"
        >
          ⇣ Sync TOI counts
        </a>
      </div>
      <p className="text-xs text-[var(--color-slate)]">
        How to use: (1) open <code className="font-mono text-[12px]">{`https://toi-coding.informatics.buu.ac.th/00-pre-toi`}</code> in a tab,
        (2) click the bookmark from that tab. You should see an alert like "TOI counts synced: 157 problems (36 ไม่นับ)".
        Re-run whenever TOI updates which problems count.
      </p>
    </div>
  );
}

type Provider = "anthropic" | "openai" | "ollama" | "claude-cli";

function AiSettings() {
  const [provider, setProvider] = useState<Provider>("ollama");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5-coder:7b");
  const [ollamaKeepAlive, setOllamaKeepAlive] = useState("0");
  const [anthropicModel, setAnthropicModel] = useState("claude-sonnet-4-5");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [claudeCliModel, setClaudeCliModel] = useState("sonnet");
  const [maxTokens, setMaxTokens] = useState(1024);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [responseLanguage, setResponseLanguage] = useState<"auto" | "th" | "en">("auto");
  const [ollamaNumCtx, setOllamaNumCtx] = useState(0);
  const [userProfile, setUserProfile] = useState("");
  const [tutorStyle, setTutorStyle] = useState("");
  const [status, setStatus] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Installed Ollama models, fetched from the server so the Model field can be a
  // dropdown instead of a free-text box. Empty + an error string means Ollama
  // wasn't reachable; the saved model stays selectable so Save never clobbers it.
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModelsErr, setOllamaModelsErr] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  async function loadStatus() {
    try { setStatus(await api.getAiStatus()); } catch (e: any) { setErr(e?.message ?? String(e)); }
  }
  async function loadOllamaModels(url?: string) {
    setLoadingModels(true); setOllamaModelsErr(null);
    try {
      const r = await api.listOllamaModels(url ?? ollamaUrl);
      setOllamaModels(r.models);
      if (!r.ok) setOllamaModelsErr(r.error ?? "Could not reach Ollama");
    } catch (e: any) {
      setOllamaModelsErr(e?.message ?? String(e));
    } finally {
      setLoadingModels(false);
    }
  }
  /**
   * Pull every persisted AI config field so the form reflects what's actually
   * on disk. Without this, the inputs render their useState defaults and
   * pressing Save quietly overwrites whatever was previously persisted (the
   * model you picked, your keep_alive duration, etc.).
   */
  async function loadConfig() {
    try {
      const c = await api.getAiConfig();
      setProvider(c.provider);
      setAnthropicModel(c.anthropicModel);
      setOpenaiModel(c.openaiModel);
      setOllamaUrl(c.ollamaUrl);
      setOllamaModel(c.ollamaModel);
      setOllamaKeepAlive(c.ollamaKeepAlive);
      setClaudeCliModel(c.claudeCliModel);
      setMaxTokens(c.maxTokens);
      setThinkingEnabled(c.thinkingEnabled);
      setResponseLanguage(c.responseLanguage);
      setOllamaNumCtx(c.ollamaNumCtx);
      setUserProfile(c.userProfile);
      setTutorStyle(c.tutorStyle);
      if (c.provider === "ollama") void loadOllamaModels(c.ollamaUrl);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
  }
  useEffect(() => { void loadStatus(); void loadConfig(); }, []);

  async function save() {
    setMsg(null); setErr(null);
    try {
      await api.saveAiSettings({
        provider,
        anthropicApiKey: anthropicKey || undefined,
        anthropicModel,
        openaiApiKey: openaiKey || undefined,
        openaiModel,
        ollamaUrl,
        ollamaModel,
        ollamaKeepAlive,
        claudeCliModel,
        maxTokens,
        thinkingEnabled,
        responseLanguage,
        ollamaNumCtx: ollamaNumCtx || undefined,
        userProfile,
        tutorStyle,
      });
      setMsg("Saved.");
      setAnthropicKey(""); setOpenaiKey("");
      // Re-fetch the canonical state so future opens reflect what's on disk.
      await Promise.all([loadStatus(), loadConfig()]);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
  }

  const inputCls = "w-full rounded-2xl border border-[var(--color-dust)] bg-white px-4 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)]";
  const textareaCls = "w-full rounded-2xl border border-[var(--color-dust)] bg-white px-4 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)] font-[450] leading-relaxed";
  const labelCls = "block text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-1.5";

  return (
    <div className="space-y-4">
      <label className="block">
        <div className={labelCls}>Provider</div>
        <select className={inputCls} value={provider} onChange={(e) => { const v = e.target.value as Provider; setProvider(v); if (v === "ollama" && ollamaModels.length === 0) void loadOllamaModels(); }}>
          <option value="ollama">Ollama (local, free)</option>
          <option value="claude-cli">Claude Code CLI (your Max subscription)</option>
          <option value="anthropic">Anthropic Claude (API key)</option>
          <option value="openai">OpenAI (API key)</option>
        </select>
      </label>

      {provider === "anthropic" && (
        <>
          <label className="block"><div className={labelCls}>Anthropic API key</div>
            <input type="password" className={inputCls} value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder={status?.hasKey ? "leave blank to keep existing" : "sk-ant-..."} /></label>
          <label className="block"><div className={labelCls}>Model</div>
            <input className={inputCls} value={anthropicModel} onChange={(e) => setAnthropicModel(e.target.value)} /></label>
        </>
      )}
      {provider === "openai" && (
        <>
          <label className="block"><div className={labelCls}>OpenAI API key</div>
            <input type="password" className={inputCls} value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder={status?.hasKey ? "leave blank to keep existing" : "sk-..."} /></label>
          <label className="block"><div className={labelCls}>Model</div>
            <input className={inputCls} value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} /></label>
          <p className="text-xs text-[var(--color-slate)]">
            Note: ChatGPT Plus does not grant API access. You need a separate API key billed per token.
          </p>
        </>
      )}
      {provider === "claude-cli" && (
        <>
          <label className="block"><div className={labelCls}>Model (claude --model)</div>
            <input className={inputCls} value={claudeCliModel} onChange={(e) => setClaudeCliModel(e.target.value)} placeholder="sonnet · opus · haiku · or full id" /></label>
          <p className="text-xs text-[var(--color-slate)]">
            Spawns <code className="font-mono text-[11px]">claude --print</code> per request. Uses your Claude Max subscription quota — no API billing. Requires the <code className="font-mono text-[11px]">claude</code> CLI on PATH and a current login.
          </p>
        </>
      )}
      {provider === "ollama" && (
        <>
          <label className="block"><div className={labelCls}>Ollama base URL</div>
            <input className={inputCls} value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} onBlur={() => void loadOllamaModels()} /></label>
          <label className="block">
            <div className={labelCls}>Model</div>
            <div className="flex items-center gap-2">
              <select className={inputCls} value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)}>
                {/* Always keep the saved model selectable, even if Ollama is down
                    or the model was since removed, so Save can't silently drop it. */}
                {Array.from(new Set([ollamaModel, ...ollamaModels].filter(Boolean))).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void loadOllamaModels()}
                disabled={loadingModels}
                title="Re-fetch installed models from Ollama"
                className="motion-press shrink-0 rounded-full border border-[var(--color-dust)] bg-white px-4 py-2.5 text-sm text-[var(--color-ink)] hover:border-[var(--color-ink)] disabled:opacity-50"
              >
                {loadingModels ? "…" : "Refresh"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-slate)]">
              {ollamaModelsErr
                ? `Couldn't reach Ollama (${ollamaModelsErr}). Showing the saved model — start Ollama, then Refresh to pick from installed ones.`
                : ollamaModels.length
                  ? `${ollamaModels.length} model${ollamaModels.length === 1 ? "" : "s"} installed (from the server above).`
                  : "Pulled from the Ollama server above. Refresh after pulling a new model."}
            </p>
          </label>
          <label className="block"><div className={labelCls}>Keep model in RAM</div>
            <input className={inputCls} value={ollamaKeepAlive} onChange={(e) => setOllamaKeepAlive(e.target.value)} placeholder="0" />
            <p className="mt-1.5 text-xs text-[var(--color-slate)]">
              <code className="font-mono text-[11px]">0</code> = unload right after each reply (frees RAM, slower next request).{" "}
              <code className="font-mono text-[11px]">5m</code> = keep loaded 5 min idle.{" "}
              <code className="font-mono text-[11px]">-1</code> = forever.
            </p>
          </label>
          <ContextLengthSlider value={ollamaNumCtx} onChange={setOllamaNumCtx} />
        </>
      )}

      <label className="block"><div className={labelCls}>Max tokens per reply</div>
        <input type="number" className={inputCls} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} /></label>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={labelCls}>Reasoning (thinking)</div>
          <p className="text-xs text-[var(--color-slate)] max-w-[42ch]">
            {thinkingEnabled
              ? "On — reason-capable models stream their chain-of-thought into a collapsible block."
              : "Off — skip the reasoning trace for a faster first token."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={thinkingEnabled}
          aria-label="Toggle reasoning"
          onClick={() => setThinkingEnabled((v) => !v)}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${thinkingEnabled ? "bg-[var(--color-ink)]" : "bg-[var(--color-dust)]"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${thinkingEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </button>
      </div>

      <label className="block"><div className={labelCls}>Reply language</div>
        <select className={inputCls} value={responseLanguage} onChange={(e) => setResponseLanguage(e.target.value as "auto" | "th" | "en")}>
          <option value="auto">Auto — match my question's language</option>
          <option value="th">ไทย — always reply in Thai</option>
          <option value="en">English — always reply in English</option>
        </select>
        <p className="mt-1.5 text-xs text-[var(--color-slate)]">Also switchable on the fly from the AI Help panel toolbar.</p>
      </label>

      <div className="border-t border-[var(--color-dust)] pt-5 mt-5">
        <div className="mb-3">
          <div className="text-[13px] font-medium text-[var(--color-ink)]">Personalize the tutor</div>
          <p className="text-xs text-[var(--color-slate)] mt-1">
            Free-form, injected into every prompt. Helps the AI fit you — your level, your language mix, how much hand-holding you want.
          </p>
        </div>

        <label className="block mb-3">
          <div className={labelCls}>About you</div>
          <textarea
            className={textareaCls}
            rows={4}
            value={userProfile}
            onChange={(e) => setUserProfile(e.target.value)}
            placeholder="e.g. M.5 student, comfortable with loops/arrays/strings, learning DP. Weak on graphs. Read English fine, prefer Thai for conceptual hints."
          />
        </label>

        <label className="block">
          <div className={labelCls}>Style preferences</div>
          <textarea
            className={textareaCls}
            rows={4}
            value={tutorStyle}
            onChange={(e) => setTutorStyle(e.target.value)}
            placeholder="e.g. Be terse. Ask one Socratic question at a time. Don't dump full solutions. Use Thai for explanations and English for code/math terms."
          />
        </label>
      </div>

      <div className="pt-2">
        <PillButton onClick={save}>Save AI settings</PillButton>
      </div>
      {msg && <div className="text-sm text-[var(--color-success)]">{msg}</div>}
      {err && <div className="text-sm text-[var(--color-danger)]">{err}</div>}

      {status && (
        <div className="mt-4 text-sm text-[var(--color-slate)]">
          Active: <span className="font-mono text-[12px] text-[var(--color-graphite)]">{status.provider} · {status.model}</span>{" "}
          {status.hasKey ? "(configured)" : "(missing key)"}
        </div>
      )}
    </div>
  );
}

// Snap points mirror Ollama's own context-length slider: model default, then
// powers-of-two from 4k up to 256k tokens.
const CTX_STEPS = [0, 4096, 8192, 16384, 32768, 65536, 131072, 262144];
const ctxLabel = (n: number) => (n === 0 ? "Model default" : `${Math.round(n / 1024)}k`);

function ContextLengthSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  // Map the saved token count to the nearest snap index (handles legacy custom values).
  const idx = CTX_STEPS.reduce(
    (best, v, i) => (Math.abs(v - value) < Math.abs(CTX_STEPS[best]! - value) ? i : best),
    0,
  );
  return (
    <label className="block">
      <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-1.5">Context length (num_ctx)</div>
      <input
        type="range"
        min={0}
        max={CTX_STEPS.length - 1}
        step={1}
        value={idx}
        onChange={(e) => onChange(CTX_STEPS[Number(e.target.value)]!)}
        className="w-full cursor-pointer accent-[var(--color-signal)]"
        aria-label="Context length"
      />
      <div className="mt-1 flex justify-between text-[10px] text-[var(--color-slate)] tabular-nums">
        {CTX_STEPS.map((n, i) => <span key={i}>{i === 0 ? "Def" : ctxLabel(n)}</span>)}
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-slate)]">
        Current: <strong className="text-[var(--color-graphite)]">{ctxLabel(value)}</strong>. Larger windows let the model see
        more of your code and chat history, at the cost of more RAM/VRAM. "Model default" leaves Ollama's built-in size.
      </p>
    </label>
  );
}
