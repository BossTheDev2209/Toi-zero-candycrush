export interface SystemPromptContext {
  language: "c" | "cpp" | "py";
  slug: string;
  title: string;
  statementMd: string;
  code: string;
  verdict: "AC" | "WA" | "TLE" | "RE" | "CE" | null;
  runtimeMs: number | null;
  diff: string | null;
  stderr: string | null;
  forceFullSolution: boolean;
  /** Free-form student bio from settings. Injected verbatim so the tutor adapts to who they are. */
  userProfile?: string | null;
  /** Free-form style preferences (language mix, hint depth, tone). Injected verbatim. */
  tutorStyle?: string | null;
  /** Forced reply language. "auto" (default) mirrors the question; "th"/"en" pin it. */
  responseLanguage?: "auto" | "th" | "en" | null;
}

const MAX_STATEMENT = 2048;
const MAX_PROFILE = 1024;
const MAX_STYLE = 1024;

function verdictNote(ctx: SystemPromptContext): string {
  if (!ctx.verdict) return "Latest local run: (none yet)";
  const head = `Latest local run: verdict=${ctx.verdict}, runtime=${ctx.runtimeMs ?? "?"}ms`;
  switch (ctx.verdict) {
    case "AC":  return `${head}\n(All sample tests passed locally. Congratulate them briefly, then suggest the next step.)`;
    case "WA":  return `${head}\nDiff (- expected, + got):\n${ctx.diff ?? "(no diff captured)"}`;
    case "TLE": return `${head}\nTheir solution is too slow. Discuss algorithm complexity, not micro-optimizations.`;
    case "RE":  return `${head}\nStderr:\n${ctx.stderr ?? "(no stderr captured)"}`;
    case "CE":  return `${head}\nCompiler output:\n${ctx.stderr ?? "(no compiler output captured)"}`;
  }
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const statement = ctx.statementMd.slice(0, MAX_STATEMENT);
  const spoilerLine = ctx.forceFullSolution
    ? "The student has explicitly asked you to show the complete solution. Do so, with explanation."
    : "Give SHORT, targeted hints. Use Socratic questions when helpful. Do NOT write the full solution unless explicitly asked.";

  const profile = (ctx.userProfile ?? "").trim().slice(0, MAX_PROFILE);
  const style = (ctx.tutorStyle ?? "").trim().slice(0, MAX_STYLE);

  const lines: string[] = [
    "You are a programming tutor for a Thai high-school student preparing for the",
    "Thailand Olympiad in Informatics (TOI). You are helping them with a competitive",
    "programming problem.",
    "",
    spoilerLine,
    "If they're close, point at the specific line or algorithm gap. If they're far,",
    "suggest the right algorithm category but make them write the code.",
  ];

  if (profile) {
    lines.push(
      "",
      "About the student (their own words — adapt your hints to fit):",
      profile,
    );
  }
  if (style) {
    lines.push(
      "",
      "Style preferences (their own words — follow these):",
      style,
    );
  }

  const langLine =
    ctx.responseLanguage === "th"
      ? "Always reply in Thai (ภาษาไทย), regardless of the question's language. Use English only for code, identifiers, and standard CS/math terms. Be concise."
      : ctx.responseLanguage === "en"
        ? "Always reply in English, regardless of the question's language. Be concise."
        : "Reply in the student's question's language (Thai or English). Be concise.";

  lines.push(
    "",
    `Language: ${ctx.language}`,
    `Problem: ${ctx.slug} — ${ctx.title}`,
    "",
    "Statement (excerpt):",
    statement,
    "",
    "Their current code:",
    "```" + ctx.language,
    ctx.code || "(empty)",
    "```",
    "",
    verdictNote(ctx),
    "",
    langLine,
  );

  return lines.join("\n");
}
