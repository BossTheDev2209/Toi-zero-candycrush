import { useState, type FormEvent } from "react";

/**
 * Sign-in surface shown when no TOI credentials are stored — either first-run
 * or after the user removes them. Full-screen, no nav, no card-in-card, no
 * modal. Editorial confidence at the top, two fields, one CTA, one note.
 *
 * Design (product register, Mastercard token system):
 *  - Canvas-cream background, no surround. The page IS the surface.
 *  - Eyebrow + tiny accent dot, headline ~48px / weight 500 / -2% tracking,
 *    body lead at weight 450.
 *  - Pill-radius inputs (20) matching the system's button radius — no 8/12
 *    middle range. Ink primary CTA at the same radius.
 *  - Auto-fill tagged correctly so password managers fill cleanly.
 *  - Failure state is a single line below the CTA, no shaking, no banner.
 */
export function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/toi/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      onAuthed();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-6 py-16">
      <form onSubmit={submit} className="w-full max-w-[480px]" noValidate>
        <div className="mb-4 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--color-slate)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-signal-light)]" aria-hidden="true" />
          <span>TOI account</span>
        </div>

        <h1 className="mb-4 text-[clamp(40px,5vw,56px)] font-medium leading-[1.04] tracking-[-0.02em] text-[var(--color-ink)]">
          Sign in to start.
        </h1>

        <p className="mb-10 text-[16px] font-[450] leading-[1.5] text-[var(--color-graphite)]">
          Your TOI Coding username and password. Stored locally in{" "}
          <code className="font-mono text-[14px] text-[var(--color-ink)]">settings.json</code>,
          never shared, never committed.
        </p>

        <div className="space-y-5">
          <label className="block">
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--color-slate)]">
              TOI username
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              placeholder="your TOI username"
              className="w-full rounded-[20px] border border-[var(--color-dust)] bg-white px-5 py-3 text-[16px] text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)]"
            />
          </label>
          <label className="block">
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--color-slate)]">
              TOI password
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="your TOI password"
              className="w-full rounded-[20px] border border-[var(--color-dust)] bg-white px-5 py-3 font-mono text-[16px] text-[var(--color-ink)] placeholder:text-[var(--color-slate)] focus:outline-none focus:border-[var(--color-ink)]"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="motion-press mt-10 w-full rounded-[20px] border-[1.5px] border-[var(--color-ink)] bg-[var(--color-ink)] px-6 py-3 text-[16px] font-medium tracking-[-0.02em] text-[var(--color-canvas)] disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        {error && (
          <p className="mt-4 text-sm text-[var(--color-signal)]" role="alert">
            {error}
          </p>
        )}

        <p className="mt-12 max-w-[420px] text-[13px] leading-[1.55] text-[var(--color-slate)]">
          Credentials refresh your TOI session cookie when it expires. Files
          stay on this machine. Nothing leaves your device.
        </p>
      </form>
    </main>
  );
}
