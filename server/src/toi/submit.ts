export interface ToiSubmitInput {
  baseUrl: string;        // e.g. "https://toi-coding.informatics.buu.ac.th/00-pre-toi"
  cookie: string;         // full Cookie header value
  xsrf: string;           // _xsrf token (form field + matches cookie)
  extraHeaders: Record<string, string>;
  slug: string;           // TOI task slug, e.g. "A1-001"
  language: "c" | "cpp";
  code: string;
}

export interface ToiSubmitResult {
  status: number | null;
  body: unknown;
  error: string | null;
}

const LANGUAGE_MAP: Record<"c" | "cpp", string> = {
  cpp: "C++17 / g++",
  c:   "C11 / gcc",
};

const FILE_EXT: Record<"c" | "cpp", string> = {
  cpp: "cpp",
  c:   "c",
};

export async function submitToToi(input: ToiSubmitInput): Promise<ToiSubmitResult> {
  const url = `${input.baseUrl.replace(/\/$/, "")}/tasks/${encodeURIComponent(input.slug)}/submit`;

  const form = new FormData();
  form.append("_xsrf", input.xsrf);
  form.append("language", LANGUAGE_MAP[input.language]);
  const filename = `solution.${FILE_EXT[input.language]}`;
  form.append("source_code", new Blob([input.code], { type: "text/plain" }), filename);

  const headers: Record<string, string> = {
    Cookie: input.cookie,
    Referer: input.baseUrl,
    "X-Xsrftoken": input.xsrf,
    ...input.extraHeaders,
  };
  // Do NOT set Content-Type — fetch sets multipart boundary automatically.

  try {
    const res = await fetch(url, { method: "POST", headers, body: form, redirect: "follow" });
    const text = await res.text();
    let parsed: unknown = text.slice(0, 4000);
    try { parsed = JSON.parse(text); } catch { /* keep as text */ }
    return {
      status: res.status,
      body: parsed,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e: any) {
    return { status: null, body: null, error: e?.message ?? String(e) };
  }
}
