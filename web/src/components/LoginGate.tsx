import { useEffect, useState, type ReactNode } from "react";
import { LoginScreen } from "./LoginScreen";

type AuthState = "checking" | "authed" | "unauth";

/**
 * Wraps the app and renders either a sign-in surface or the children, based on
 * whether the server has TOI credentials stored. The gate fires once on mount
 * and again whenever the child surface signals an auth change (after a Settings
 * "Save and re-login" or a manual credentials wipe).
 *
 * The brief intentionally short loading state is rendered as a quiet canvas
 * with no spinner: the auth-status endpoint is local and returns in <50 ms,
 * so any visible spinner would flash and feel worse than a still pause.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");

  async function check() {
    try {
      const r = await fetch("/api/toi/auth-status");
      const data = (await r.json()) as { hasCredentials?: boolean };
      setState(data.hasCredentials ? "authed" : "unauth");
    } catch {
      // Server down or auth-status broken — surface the sign-in screen so the
      // user can at least re-enter credentials and see if that recovers things.
      setState("unauth");
    }
  }

  useEffect(() => { void check(); }, []);

  if (state === "checking") {
    return <div className="min-h-screen bg-[var(--color-canvas)]" aria-hidden="true" />;
  }
  if (state === "unauth") {
    return <LoginScreen onAuthed={() => setState("authed")} />;
  }
  return <>{children}</>;
}
