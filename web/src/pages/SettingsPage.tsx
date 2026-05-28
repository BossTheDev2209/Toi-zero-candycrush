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

      <section className="motion-surface mt-8 rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-8">
        <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-3">AI assistant</div>
        <AiSettings />
      </section>
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
  const [userProfile, setUserProfile] = useState("");
  const [tutorStyle, setTutorStyle] = useState("");
  const [status, setStatus] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadStatus() {
    try { setStatus(await api.getAiStatus()); } catch (e: any) { setErr(e?.message ?? String(e)); }
  }
  async function loadPersonalization() {
    try {
      const p = await api.getAiPersonalization();
      setUserProfile(p.userProfile);
      setTutorStyle(p.tutorStyle);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
  }
  useEffect(() => { void loadStatus(); void loadPersonalization(); }, []);

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
        userProfile,
        tutorStyle,
      });
      setMsg("Saved.");
      setAnthropicKey(""); setOpenaiKey("");
      await loadStatus();
    } catch (e: any) { setErr(e?.message ?? String(e)); }
  }

  const inputCls = "w-full rounded-2xl border border-[var(--color-dust)] bg-white px-4 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)]";
  const textareaCls = "w-full rounded-2xl border border-[var(--color-dust)] bg-white px-4 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)] font-[450] leading-relaxed";
  const labelCls = "block text-[12px] font-bold tracking-[0.04em] uppercase text-[var(--color-slate)] mb-1.5";

  return (
    <div className="space-y-4">
      <label className="block">
        <div className={labelCls}>Provider</div>
        <select className={inputCls} value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
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
            <input className={inputCls} value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} /></label>
          <label className="block"><div className={labelCls}>Model</div>
            <input className={inputCls} value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} /></label>
          <label className="block"><div className={labelCls}>Keep model in RAM</div>
            <input className={inputCls} value={ollamaKeepAlive} onChange={(e) => setOllamaKeepAlive(e.target.value)} placeholder="0" />
            <p className="mt-1.5 text-xs text-[var(--color-slate)]">
              <code className="font-mono text-[11px]">0</code> = unload right after each reply (frees RAM, slower next request).{" "}
              <code className="font-mono text-[11px]">5m</code> = keep loaded 5 min idle.{" "}
              <code className="font-mono text-[11px]">-1</code> = forever.
            </p>
          </label>
        </>
      )}

      <label className="block"><div className={labelCls}>Max tokens per reply</div>
        <input type="number" className={inputCls} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} /></label>

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
