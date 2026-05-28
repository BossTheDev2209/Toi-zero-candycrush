import type { Problem, ProblemDetail, JudgeResult, RunRow, Language, Qualification, ScoreSyncProgress } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
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
  listRuns: (problemId: number) => fetch(`/api/runs/${problemId}`).then(json<RunRow[]>),
  submitToToi: (problemId: number, language: Language, code: string) =>
    fetch(`/api/toi/${problemId}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code }) }).then(json<{ status: number | null; body: unknown; error: string | null; submitted?: boolean; finalUrl?: string; redirected?: boolean; contentType?: string }>),
  syncPdf: (problemId: number) =>
    fetch(`/api/problems/${problemId}/pdf/sync`, { method: "POST" }).then(json<{ ok: boolean; sizeKb?: number; error?: string }>),
  syncAllPdfs: () =>
    fetch("/api/problems/sync-pdfs", { method: "POST" }).then(json<{ synced: number; skipped: number; failed: { slug: string; error: string }[] }>),
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
  }>),
  getAiPersonalization: () =>
    fetch("/api/ai/personalization").then(json<{ userProfile: string; tutorStyle: string }>),
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
    userProfile?: string;
    tutorStyle?: string;
  }) =>
    fetch("/api/ai/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean; provider: string }>),
  getAiHistory: (problemId: number) =>
    fetch(`/api/ai/history/${problemId}`).then(json<{ messages: { id: number; role: "user" | "assistant"; content: string; tokens_in: number | null; tokens_out: number | null; created_at: string }[] }>),
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
    }).then(json<{ ok: boolean; deleted?: number; error?: string; messages?: { id: number; role: "user" | "assistant"; content: string; tokens_in: number | null; tokens_out: number | null; created_at: string }[] }>),
  regenerateAi: (body: { problemId: number; forceFullSolution?: boolean }) =>
    fetch("/api/ai/regenerate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<{ ok: boolean; cancelled?: boolean; text?: string; provider?: string; model?: string; tokensIn?: number; tokensOut?: number; error?: string }>),
};
