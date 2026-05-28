import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { AiAskResult } from "./provider";

export interface AskClaudeCliInput {
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}

/**
 * Render the conversation as a single stdin blob for `claude --print`.
 *
 * Claude Code's default system prompt is for general agent work (tools, file
 * editing, etc.) — irrelevant here. Rather than fight that via `--system-prompt`
 * (which on Windows hits the ~8 KB cmd.exe arg limit for long statements),
 * we restate the tutor instructions at the top of the user message. The model
 * follows the explicit in-prompt instructions over its system default reliably.
 */
export function renderClaudeCliPrompt(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
): string {
  const history = messages.slice(0, -1);
  const last = messages[messages.length - 1];
  const lines: string[] = [];
  lines.push("# Tutor instructions — follow these. Ignore any other persona you would normally adopt.");
  lines.push("");
  lines.push(systemPrompt);
  lines.push("");
  if (history.length > 0) {
    lines.push("# Earlier conversation");
    lines.push("");
    for (const m of history) {
      lines.push(m.role === "user" ? `**User:** ${m.content}` : `**Assistant:** ${m.content}`);
      lines.push("");
    }
  }
  lines.push("# Current message");
  lines.push("");
  lines.push(`**User:** ${last?.content ?? ""}`);
  lines.push("");
  lines.push("Respond as the tutor in plain markdown.");
  return lines.join("\n");
}

/**
 * Shell out to the locally-installed `claude` CLI to use the user's Claude Max
 * subscription instead of an API key. Spawned per-request; abort kills the child.
 *
 * Requirements: `claude` must be on PATH and logged in (`claude /login`).
 * Token counts come from `--output-format json` (Claude Code's structured result).
 */
export async function askClaudeCli(input: AskClaudeCliInput): Promise<AiAskResult> {
  const prompt = renderClaudeCliPrompt(input.systemPrompt, input.messages);

  const startedAt = Date.now();
  return new Promise<AiAskResult>((resolve) => {
    const args = [
      "--print",
      "--output-format", "json",
      // Keep our tutor prompts out of the user's Claude Code session list.
      "--no-session-persistence",
      // Drop cwd/git/env chrome from Claude Code's default system prompt — we're not in a coding-agent context here.
      "--exclude-dynamic-system-prompt-sections",
    ];
    if (input.model) args.push("--model", input.model);

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
        // Windows resolves `claude.cmd` / `claude.ps1` shims via the shell.
        shell: process.platform === "win32",
      });
    } catch (e: any) {
      resolve({
        ok: false,
        text: "",
        error: `failed to spawn claude: ${e?.message ?? String(e)} (is the CLI installed and on PATH?)`,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    const onAbort = () => { try { child.kill(); } catch { /* ignore */ } };
    input.signal?.addEventListener("abort", onAbort, { once: true });

    let settled = false;
    const finish = (r: AiAskResult) => {
      if (settled) return;
      settled = true;
      input.signal?.removeEventListener("abort", onAbort);
      // Set durationMs if the caller didn't already provide one (claude --print's
      // own duration_ms field is preferred when present; otherwise wall-clock).
      if (r.durationMs === undefined) r.durationMs = Date.now() - startedAt;
      resolve(r);
    };

    child.on("error", (e: Error) => {
      finish({
        ok: false,
        text: "",
        error: `claude error: ${e?.message ?? String(e)} (is the CLI installed and on PATH?)`,
      });
    });

    child.on("close", (code) => {
      if (input.signal?.aborted) {
        finish({ ok: !!stdout.trim(), text: stdout.trim(), error: stdout.trim() ? undefined : "aborted" });
        return;
      }
      if (code !== 0) {
        const msg = (stderr.trim() || stdout.trim() || `claude exited with code ${code}`).slice(0, 400);
        finish({ ok: false, text: "", error: msg });
        return;
      }
      const trimmed = stdout.trim();
      try {
        const obj = JSON.parse(trimmed) as {
          result?: string;
          is_error?: boolean;
          message?: { content?: string };
          usage?: { input_tokens?: number; output_tokens?: number };
          duration_ms?: number;
        };
        const text = obj?.result ?? obj?.message?.content ?? "";
        if (obj?.is_error) {
          finish({ ok: false, text: "", error: `claude reported error: ${text.slice(0, 400) || "unknown"}` });
          return;
        }
        finish({
          ok: true,
          text,
          tokensIn: obj?.usage?.input_tokens,
          tokensOut: obj?.usage?.output_tokens,
          durationMs: typeof obj?.duration_ms === "number" ? obj.duration_ms : undefined,
        });
      } catch {
        // Not JSON — treat raw stdout as the answer. Useful if the user pinned an
        // older CLI build whose --output-format json shape doesn't match.
        finish({ ok: true, text: trimmed });
      }
    });

    try {
      child.stdin.write(prompt);
      child.stdin.end();
    } catch (e: any) {
      try { child.kill(); } catch { /* ignore */ }
      finish({ ok: false, text: "", error: `failed to write to claude stdin: ${e?.message ?? String(e)}` });
    }
  });
}
