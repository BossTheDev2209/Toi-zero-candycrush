import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "bun:sqlite";
import type { AppConfig } from "../config";
import { persistAiUpdate } from "../config";
import { problemRepo } from "../db/repo/problems";
import { solutionRepo } from "../db/repo/solutions";
import { runRepo } from "../db/repo/runs";
import { aiMessageRepo } from "../db/repo/ai_messages";
import { buildProvider } from "../ai/provider";
import { buildSystemPrompt } from "../ai/systemPrompt";

const AskZ = z.object({
  problemId: z.number().int().positive(),
  message: z.string().min(1),
  forceFullSolution: z.boolean().default(false),
});

const AiSettingsZ = z.object({
  provider: z.enum(["anthropic", "openai", "ollama"]),
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string().optional(),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  ollamaUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

export function aiRouter(db: Database, cfg: AppConfig) {
  const r = new Hono();
  const pRepo = problemRepo(db);
  const sRepo = solutionRepo(db);
  const rRepo = runRepo(db);
  const mRepo = aiMessageRepo(db);

  r.get("/status", (c) => {
    const provider = cfg.ai?.provider ?? "ollama";
    let hasKey = false;
    let model = "";
    if (provider === "anthropic") { hasKey = Boolean(cfg.ai?.anthropicApiKey); model = cfg.ai?.anthropicModel ?? "claude-sonnet-4-5"; }
    else if (provider === "openai") { hasKey = Boolean(cfg.ai?.openaiApiKey); model = cfg.ai?.openaiModel ?? "gpt-4o-mini"; }
    else { hasKey = true; model = cfg.ai?.ollamaModel ?? "qwen2.5-coder:7b"; }
    return c.json({ provider, model, hasKey });
  });

  r.get("/history/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    return c.json({ messages: mRepo.listForProblem(id) });
  });

  r.delete("/history/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    const deleted = mRepo.clearForProblem(id);
    return c.json({ deleted });
  });

  r.post("/ask", async (c) => {
    const body = AskZ.parse(await c.req.json());
    const problem = pRepo.getById(body.problemId);
    if (!problem) return c.json({ ok: false, error: "problem not found" }, 404);

    const solution = sRepo.get(body.problemId);
    const language = (solution?.language ?? "cpp") as "c" | "cpp" | "py";
    const code = solution?.code ?? "";
    const recent = rRepo.listRecent(body.problemId, 1)[0];

    let diff: string | null = null;
    let stderr: string | null = null;
    if (recent) {
      const perTest = JSON.parse(recent.per_test_json) as { diff?: string; stderr?: string }[];
      diff = perTest.find((t) => t.diff)?.diff ?? null;
      stderr = perTest.find((t) => t.stderr)?.stderr ?? null;
    }

    const systemPrompt = buildSystemPrompt({
      language,
      slug: problem.slug,
      title: problem.title,
      statementMd: problem.statement_md,
      code,
      verdict: (recent?.verdict as any) ?? null,
      runtimeMs: recent?.total_runtime_ms ?? null,
      diff,
      stderr,
      forceFullSolution: body.forceFullSolution,
    });

    const history = mRepo.listForProblem(body.problemId).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    history.push({ role: "user", content: body.message });

    mRepo.create({
      problemId: body.problemId,
      role: "user",
      content: body.message,
      provider: null,
      model: null,
      tokensIn: null,
      tokensOut: null,
    });

    const provider = buildProvider(cfg.ai);
    const result = await provider.ask({
      systemPrompt,
      messages: history,
      maxTokens: cfg.ai?.maxTokens ?? 1024,
    });

    if (!result.ok) {
      return c.json({ ok: false, error: result.error, provider: provider.name, model: provider.model }, 502);
    }

    mRepo.create({
      problemId: body.problemId,
      role: "assistant",
      content: result.text,
      provider: provider.name,
      model: provider.model,
      tokensIn: result.tokensIn ?? null,
      tokensOut: result.tokensOut ?? null,
    });

    return c.json({
      ok: true,
      text: result.text,
      provider: provider.name,
      model: provider.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
  });

  r.post("/settings", async (c) => {
    const body = AiSettingsZ.parse(await c.req.json());
    persistAiUpdate(cfg, body);
    return c.json({ ok: true, provider: body.provider });
  });

  return r;
}
