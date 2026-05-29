import type { Problem, ProblemDetail, JudgeResult, RunRow, Language, Qualification, ScoreSyncProgress, PdfSyncProgress } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export interface AiStreamHandlers {
  /** Fired for each streamed chunk. Either field may be present. */
  onDelta?: (d: { content?: string; thinking?: string }) => void;
  /** Abort the underlying request (in addition to the server-side /cancel). */
  signal?: AbortSignal;
}

export interface AiStreamResult {
  ok: boolean;
  cancelled?: boolean;
  text?: string;
  thinking?: string;
  provider?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs?: number;
  error?: string;
}

/**
 * POST a request whose response is an SSE stream of `delta` / `done` / `error`
 * events, forwarding deltas live and resolving with the terminal `done`/`error`
 * payload. Used by AI Help so the reply (and reasoning) render as they generate.
 */
async function streamAi(url: string, body: unknown, handlers: AiStreamHandlers): Promise<AiStreamResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });
  if (!res.ok || !res.body) {
    return { ok: false, error: `${res.status} ${await res.text().catch(() => "")}` };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: AiStreamResult = { ok: false, error: "stream ended without a result" };

  const handleEvent = (raw: string) => {
    // One SSE event block: `event: <name>` + one or more `data: <json>` lines.
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    let payload: any;
    try { payload = JSON.parse(dataLines.join("\n")); } catch { return; }
    if (event === "delta") handlers.onDelta?.(payload);
    else if (event === "done") final = payload as AiStreamResult;
    else if (event === "error") final = { ok: false, error: payload?.error ?? "stream error", provider: payload?.provider, model: payload?.model };
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        handleEvent(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
      }
    }
    if (buffer.trim()) handleEvent(buffer);
  } catch (e: any) {
    if (e?.name === "AbortError") return { ...final, cancelled: true };
    return { ok: false, error: e?.message ?? String(e) };
  }
  return final;
}

export const api = {
  listProblems: () => fetch("/api/problems").then(json<Problem[]>),
  getProblem: (id: number) => fetch(`/api/problems/${id}`).then(json<ProblemDetail>),
  createProblem: (body: unknown) =>
    fetch("/api/problems", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ id: number }>),
  updateProblem: (id: number, body: unknown) =>
    fetch(`/api/problems/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean }>),
  updateProgressFlags: (id: number, body: { toiPreviousYear: boolean; toiPreviousYearNote: string }) =>
    fetch(`/api/problems/${id}/progress-flags`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean; problem: Problem | null }>),
  updateCounts: (id: number, toiCounts: boolean) =>
    fetch(`/api/problems/${id}/counts`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ toiCounts }) }).then(json<{ ok: boolean; problem: Problem | null }>),
  deleteProblem: (id: number) =>
    fetch(`/api/problems/${id}`, { method: "DELETE" }).then(json<{ ok: boolean }>),
  getSolution: (problemId: number) =>
    fetch(`/api/solutions/${problemId}`).then(json<{ id: number; language: Language; code: string } | null>),
  saveSolution: (problemId: number, language: Language, code: string) =>
    fetch(`/api/solutions/${problemId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code }) }).then(json<{ ok: boolean }>),
  runCode: (problemId: number, language: Language, code: string, scope: "sample" | "all") =>
    fetch(`/api/runs/${problemId}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code, scope }) }).then(json<JudgeResult>),
  execCode: (problemId: number, language: Language, code: string, input: string) =>
    fetch(`/api/runs/${problemId}/exec`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code, input }) }).then(
      json<{ ok: boolean; compileStderr?: string; stdout: string; stderr: string; exit: number | null; runtimeMs: number; timedOut: boolean }>,
    ),
  listRuns: (problemId: number) => fetch(`/api/runs/${problemId}`).then(json<RunRow[]>),
  submitToToi: (problemId: number, language: Language, code: string) =>
    fetch(`/api/toi/${problemId}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code }) }).then(json<{ status: number | null; body: unknown; error: string | null; submitted?: boolean; finalUrl?: string; redirected?: boolean; contentType?: string }>),
  importToiSubmission: (problemId: number) =>
    fetch(`/api/toi/${problemId}/import-submission`, { method: "POST" }).then(
      json<{ ok: true; language: Language; code: string; score: number; submissionId: number } | { ok: false; error: string }>,
    ),
  syncPdf: (problemId: number) =>
    fetch(`/api/problems/${problemId}/pdf/sync`, { method: "POST" }).then(json<{ ok: boolean; sizeKb?: number; error?: string }>),
  startPdfSync: () =>
    fetch("/api/problems/sync-pdfs", { method: "POST" }).then(json<PdfSyncProgress>),
  getPdfSyncProgress: () =>
    fetch("/api/problems/sync-pdfs-progress").then(json<PdfSyncProgress>),
  getQualification: () => fetch("/api/qualification").then(json<Qualification>),
  startScoreSync: () => fetch("/api/toi/sync-scores", { method: "POST" }).then(json<ScoreSyncProgress>),
  getScoreSyncProgress: () => fetch("/api/toi/sync-progress").then(json<ScoreSyncProgress>),
  startSubmitAll: () =>
    fetch("/api/toi/submit-all", { method: "POST" }).then(json<{
      running: boolean; total: number; done: number; succeeded: number;
      failed: { slug: string; error: string }[];
      startedAt: string | null; finishedAt: string | null;
    }>),
  getSubmitAllProgress: () =>
    fetch("/api/toi/submit-all-progress").then(json<{
      running: boolean; total: number; done: number; succeeded: number;
      failed: { slug: string; error: string }[];
      startedAt: string | null; finishedAt: string | null;
    }>),
  syncCounts: () =>
    fetch("/api/toi/sync-counts", { method: "POST" }).then(
      json<{ ok: true; seen: number; updated: number; notFoundInDb: string[]; uncounted: number } | { ok: false; error: string }>,
    ),
  getAiStatus: () => fetch("/api/ai/status").then(json<{
    provider: string;
    model: string;
    hasKey: boolean;
    hasUserProfile?: boolean;
    hasTutorStyle?: boolean;
    thinkingEnabled?: boolean;
    responseLanguage?: "auto" | "th" | "en";
  }>),
  listOllamaModels: (url?: string) =>
    fetch(`/api/ai/ollama-models${url ? `?url=${encodeURIComponent(url)}` : ""}`).then(
      json<{ ok: boolean; models: string[]; error?: string }>,
    ),
  getAiPersonalization: () =>
    fetch("/api/ai/personalization").then(json<{ userProfile: string; tutorStyle: string }>),
  getAiConfig: () =>
    fetch("/api/ai/config").then(json<{
      provider: "anthropic" | "openai" | "ollama" | "claude-cli";
      anthropicModel: string;
      openaiModel: string;
      ollamaUrl: string;
      ollamaModel: string;
      ollamaKeepAlive: string;
      claudeCliModel: string;
      maxTokens: number;
      thinkingEnabled: boolean;
      responseLanguage: "auto" | "th" | "en";
      ollamaNumCtx: number;
      userProfile: string;
      tutorStyle: string;
      hasAnthropicKey: boolean;
      hasOpenaiKey: boolean;
    }>),
  saveAiSettings: (body: {
    provider: "anthropic" | "openai" | "ollama" | "claude-cli";
    anthropicApiKey?: string;
    anthropicModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
    ollamaKeepAlive?: string;
    claudeCliModel?: string;
    maxTokens?: number;
    thinkingEnabled?: boolean;
    responseLanguage?: "auto" | "th" | "en";
    ollamaNumCtx?: number;
    userProfile?: string;
    tutorStyle?: string;
  }) =>
    fetch("/api/ai/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean; provider: string }>),
  saveQuickAiSettings: (body: { thinkingEnabled?: boolean; responseLanguage?: "auto" | "th" | "en" }) =>
    fetch("/api/ai/quick-settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
      json<{ ok: boolean; thinkingEnabled: boolean; responseLanguage: "auto" | "th" | "en" }>,
    ),
  getAiHistory: (problemId: number) =>
    fetch(`/api/ai/history/${problemId}`).then(json<{ messages: { id: number; role: "user" | "assistant"; content: string; tokens_in: number | null; tokens_out: number | null; thinking: string | null; duration_ms: number | null; created_at: string }[] }>),
  clearAiHistory: (problemId: number) =>
    fetch(`/api/ai/history/${problemId}`, { method: "DELETE" }).then(json<{ deleted: number }>),
  askAi: (body: { problemId: number; message: string; forceFullSolution?: boolean }) =>
    fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean; cancelled?: boolean; text?: string; provider?: string; model?: string; tokensIn?: number; tokensOut?: number; error?: string }>),
  cancelAi: (problemId: number) =>
    fetch(`/api/ai/cancel/${problemId}`, { method: "POST" }).then(json<{ cancelled: boolean }>),
  editAiMessage: (id: number, content: string) =>
    fetch(`/api/ai/messages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    }).then(json<{ ok: boolean; deleted?: number; error?: string; messages?: { id: number; role: "user" | "assistant"; content: string; tokens_in: number | null; tokens_out: number | null; thinking: string | null; duration_ms: number | null; created_at: string }[] }>),
  regenerateAi: (body: { problemId: number; forceFullSolution?: boolean }) =>
    fetch("/api/ai/regenerate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean; cancelled?: boolean; text?: string; provider?: string; model?: string; tokensIn?: number; tokensOut?: number; error?: string }>),
  askAiStream: (body: { problemId: number; message: string; forceFullSolution?: boolean }, handlers: AiStreamHandlers = {}) =>
    streamAi("/api/ai/ask-stream", body, handlers),
  regenerateAiStream: (body: { problemId: number; forceFullSolution?: boolean }, handlers: AiStreamHandlers = {}) =>
    streamAi("/api/ai/regenerate-stream", body, handlers),
};
