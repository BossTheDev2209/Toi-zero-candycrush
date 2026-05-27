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
};
