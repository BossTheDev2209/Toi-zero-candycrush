import type { Problem, ProblemDetail, JudgeResult, RunRow, Language } from "./types";

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
    fetch(`/api/toi/${problemId}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, code }) }).then(json<{ status: number | null; body: unknown; error: string | null }>),
};
