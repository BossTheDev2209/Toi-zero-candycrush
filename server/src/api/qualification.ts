import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { problemRepo } from "../db/repo/problems";

export function qualificationRouter(db: Database) {
  const r = new Hono();
  const repo = problemRepo(db);

  r.get("/", (c) => c.json(repo.qualification()));

  return r;
}
