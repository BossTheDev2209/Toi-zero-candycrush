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
  provider: z.enum(["anthropic", "openai", "ollama", "claude-cli"]),
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string().optional(),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  ollamaUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  ollamaKeepAlive: z.string().optional(),
  claudeCliModel: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  userProfile: z.string().optional(),
  tutorStyle: z.string().optional(),
});

export function aiRouter(db: Database, cfg: AppConfig) {
  const r = new Hono();
  const pRepo = problemRepo(db);
  const sRepo = solutionRepo(db);
  const rRepo = runRepo(db);
  const mRepo = aiMessageRepo(db);

  // One in-flight ask per problem. The Stop button hits /cancel/:problemId to
  // signal abort; the provider stops generation and returns whatever partial
  // text it has, which we still persist so the user sees what was generated.
  const activeAsks = new Map<number, AbortController>();

  r.get("/status", (c) => {
    const provider = cfg.ai?.provider ?? "ollama";
    let hasKey = false;
    let model = "";
    if (provider === "anthropic") { hasKey = Boolean(cfg.ai?.anthropicApiKey); model = cfg.ai?.anthropicModel ?? "claude-sonnet-4-5"; }
    else if (provider === "openai") { hasKey = Boolean(cfg.ai?.openaiApiKey); model = cfg.ai?.openaiModel ?? "gpt-4o-mini"; }
    else if (provider === "claude-cli") { hasKey = true; model = cfg.ai?.claudeCliModel ?? "sonnet"; }
    else { hasKey = true; model = cfg.ai?.ollamaModel ?? "qwen2.5-coder:7b"; }
    return c.json({
      provider,
      model,
      hasKey,
      hasUserProfile: Boolean(cfg.ai?.userProfile?.trim()),
      hasTutorStyle: Boolean(cfg.ai?.tutorStyle?.trim()),
    });
  });

  /** Get the current personalization for editing in Settings. */
  r.get("/personalization", (c) => c.json({
    userProfile: cfg.ai?.userProfile ?? "",
    tutorStyle: cfg.ai?.tutorStyle ?? "",
  }));

  r.get("/history/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    return c.json({ messages: mRepo.listForProblem(id) });
  });

  r.delete("/history/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    const deleted = mRepo.clearForProblem(id);
    return c.json({ deleted });
  });

  r.post("/cancel/:problemId", (c) => {
    const id = Number(c.req.param("problemId"));
    const ctrl = activeAsks.get(id);
    if (!ctrl) return c.json({ cancelled: false });
    ctrl.abort();
    activeAsks.delete(id);
    return c.json({ cancelled: true });
  });

  /**
   * Edit a past user message. Truncates every later message in the same
   * conversation (the assistant reply that followed and any subsequent turns
   * built on it). Frontend then calls /regenerate to get a fresh assistant reply.
   *
   * Only user messages are editable — editing what the AI "said" would be
   * cosmetic at best and confusing at worst.
   */
  r.patch("/messages/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json()) as { content?: unknown };
    if (typeof body.content !== "string" || !body.content.trim()) {
      return c.json({ ok: false, error: "content required" }, 400);
    }
    const msg = mRepo.getById(id);
    if (!msg) return c.json({ ok: false, error: "message not found" }, 404);
    if (msg.role !== "user") {
      return c.json({ ok: false, error: "only user messages can be edited" }, 400);
    }
    mRepo.updateContent(id, body.content);
    const deleted = mRepo.deleteAfter(msg.problem_id, id);
    return c.json({
      ok: true,
      deleted,
      messages: mRepo.listForProblem(msg.problem_id),
    });
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
      userProfile: cfg.ai?.userProfile,
      tutorStyle: cfg.ai?.tutorStyle,
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

    // Replace any prior in-flight request for this problem so the new one can be
    // independently cancelled. (The old one will have already settled or be in
    // a terminal state by the time the user can start a second request.)
    const prior = activeAsks.get(body.problemId);
    if (prior) prior.abort();
    const controller = new AbortController();
    activeAsks.set(body.problemId, controller);

    const provider = buildProvider(cfg.ai);
    let result;
    try {
      result = await provider.ask({
        systemPrompt,
        messages: history,
        maxTokens: cfg.ai?.maxTokens ?? 1024,
        signal: controller.signal,
      });
    } finally {
      // Only delete if this controller is still the active one (don't clobber a
      // newer in-flight request that replaced us).
      if (activeAsks.get(body.problemId) === controller) {
        activeAsks.delete(body.problemId);
      }
    }

    const wasAborted = controller.signal.aborted;

    // On abort, persist whatever partial assistant text we got (might be empty)
    // and return ok:false with a cancelled marker so the client treats this as a
    // normal stop rather than an error.
    if (wasAborted) {
      const partial = result.text ?? "";
      if (partial.trim()) {
        mRepo.create({
          problemId: body.problemId,
          role: "assistant",
          content: partial + "\n\n_(stopped)_",
          provider: provider.name,
          model: provider.model,
          tokensIn: result.tokensIn ?? null,
          tokensOut: result.tokensOut ?? null,
          thinking: result.thinking ?? null,
          durationMs: result.durationMs ?? null,
        });
      }
      return c.json({
        ok: false,
        cancelled: true,
        text: partial,
        thinking: result.thinking,
        provider: provider.name,
        model: provider.model,
        durationMs: result.durationMs,
      });
    }

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
      thinking: result.thinking ?? null,
      durationMs: result.durationMs ?? null,
    });

    return c.json({
      ok: true,
      text: result.text,
      thinking: result.thinking,
      provider: provider.name,
      model: provider.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      durationMs: result.durationMs,
    });
  });

  /**
   * Regenerate the assistant reply for the current conversation state. Does NOT
   * insert a new user message — assumes the history already ends with one (which
   * is what /messages/:id PATCH leaves it as after edit-and-truncate). Same
   * abort/recovery plumbing as /ask.
   */
  const RegenerateZ = z.object({
    problemId: z.number().int().positive(),
    forceFullSolution: z.boolean().default(false),
  });
  r.post("/regenerate", async (c) => {
    const body = RegenerateZ.parse(await c.req.json());
    const problem = pRepo.getById(body.problemId);
    if (!problem) return c.json({ ok: false, error: "problem not found" }, 404);

    const history = mRepo.listForProblem(body.problemId).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    if (history.length === 0 || history[history.length - 1]!.role !== "user") {
      return c.json({ ok: false, error: "no user message at the tail of the conversation to regenerate from" }, 400);
    }

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
      userProfile: cfg.ai?.userProfile,
      tutorStyle: cfg.ai?.tutorStyle,
    });

    const prior = activeAsks.get(body.problemId);
    if (prior) prior.abort();
    const controller = new AbortController();
    activeAsks.set(body.problemId, controller);

    const provider = buildProvider(cfg.ai);
    let result;
    try {
      result = await provider.ask({
        systemPrompt,
        messages: history,
        maxTokens: cfg.ai?.maxTokens ?? 1024,
        signal: controller.signal,
      });
    } finally {
      if (activeAsks.get(body.problemId) === controller) {
        activeAsks.delete(body.problemId);
      }
    }

    if (controller.signal.aborted) {
      const partial = result.text ?? "";
      if (partial.trim()) {
        mRepo.create({
          problemId: body.problemId,
          role: "assistant",
          content: partial + "\n\n_(stopped)_",
          provider: provider.name,
          model: provider.model,
          tokensIn: result.tokensIn ?? null,
          tokensOut: result.tokensOut ?? null,
          thinking: result.thinking ?? null,
          durationMs: result.durationMs ?? null,
        });
      }
      return c.json({
        ok: false, cancelled: true, text: partial,
        thinking: result.thinking,
        provider: provider.name, model: provider.model,
        durationMs: result.durationMs,
      });
    }
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
      thinking: result.thinking ?? null,
      durationMs: result.durationMs ?? null,
    });
    return c.json({
      ok: true, text: result.text,
      thinking: result.thinking,
      provider: provider.name, model: provider.model,
      tokensIn: result.tokensIn, tokensOut: result.tokensOut,
      durationMs: result.durationMs,
    });
  });

  r.post("/settings", async (c) => {
    const body = AiSettingsZ.parse(await c.req.json());
    persistAiUpdate(cfg, body);
    return c.json({ ok: true, provider: body.provider });
  });

  return r;
}
