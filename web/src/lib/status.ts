import type { Problem, Qualification } from "./types";
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
