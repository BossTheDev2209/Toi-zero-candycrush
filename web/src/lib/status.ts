import type { Problem, Qualification, ProblemFilterMode, ProblemSortMode } from "./types";
import { problemSection } from "./path-geometry";

export type ProblemNodeStatus = "unsolved" | "attempted" | "eighty" | "perfect" | "locked";

export function qualificationFromProblems(problems: Problem[]): Qualification {
  const a1Count = problems.filter((p) => problemSection(p.category) === "A1" && p.toi_best_score >= 80).length;
  const a2a3Count = problems.filter((p) => {
    const section = problemSection(p.category);
    return (section === "A2" || section === "A3") && p.toi_best_score >= 80;
  }).length;
  return { a1Count, a2a3Count, qualified: a1Count >= 20 && a2a3Count >= 20 };
}

export function isSectionLocked(problem: Problem, qualification: Qualification, openedIds: Set<number>): boolean {
  const section = problemSection(problem.category);
  return (section === "A2" || section === "A3") && qualification.a1Count < 20 && !openedIds.has(problem.id);
}

export function nodeStatus(problem: Problem, qualification: Qualification, openedIds: Set<number>): ProblemNodeStatus {
  if (isSectionLocked(problem, qualification, openedIds)) return "locked";
  if (problem.toi_best_score >= 100) return "perfect";
  if (problem.toi_best_score >= 80) return "eighty";
  if ((problem.local_run_count ?? 0) > 0 || openedIds.has(problem.id)) return "attempted";
  return "unsolved";
}

export function isPreviousYear(problem: Problem): boolean {
  return problem.toi_previous_year === 1;
}

export function filterProblem(problem: Problem, mode: ProblemFilterMode, status: ProblemNodeStatus, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  const queryMatches = !normalized || `${problem.slug} ${problem.title}`.toLowerCase().includes(normalized);
  if (!queryMatches) return false;

  if (mode === "all") return true;
  if (mode === "unsolved") return status === "unsolved" || status === "locked";
  if (mode === "80+") return problem.toi_best_score >= 80;
  if (mode === "100") return problem.toi_best_score >= 100;
  if (mode === "previous-year") return isPreviousYear(problem);
  return true;
}

const STATUS_RANK: Record<ProblemNodeStatus, number> = {
  perfect: 0,
  eighty: 1,
  attempted: 2,
  unsolved: 3,
  locked: 4,
};

export function sortProblems(
  problems: Problem[],
  mode: ProblemSortMode,
  statusFor: (problem: Problem) => ProblemNodeStatus
): Problem[] {
  return [...problems].sort((a, b) => {
    if (mode === "score") return (b.toi_best_score - a.toi_best_score) || a.slug.localeCompare(b.slug);
    if (mode === "status") return (STATUS_RANK[statusFor(a)] - STATUS_RANK[statusFor(b)]) || a.slug.localeCompare(b.slug);
    if (mode === "previous-year") return (Number(isPreviousYear(b)) - Number(isPreviousYear(a))) || a.slug.localeCompare(b.slug);
    if (mode === "unsolved-first") {
      const aOpen = statusFor(a) === "unsolved" || statusFor(a) === "locked" ? 0 : 1;
      const bOpen = statusFor(b) === "unsolved" || statusFor(b) === "locked" ? 0 : 1;
      return (aOpen - bOpen) || a.slug.localeCompare(b.slug);
    }
    return a.slug.localeCompare(b.slug);
  });
}
