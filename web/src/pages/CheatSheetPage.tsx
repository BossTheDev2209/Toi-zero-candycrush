import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CHEAT_ENTRIES, CHEATSHEET_SOURCES, type CheatLang } from "../data/cheatsheet/meta";
import { CheatSheetTOC } from "../components/CheatSheetTOC";
import { EyebrowLabel } from "../components/EyebrowLabel";

const LANG_LABELS: Record<CheatLang, string> = { cpp: "C++", c: "C", py: "Python" };
const KEYWORDS = new Set([
  "auto", "bool", "break", "case", "char", "class", "const", "continue", "def", "default", "deque",
  "dict", "do", "double", "else", "False", "float", "for", "from", "if", "import", "in", "int",
  "long", "map", "namespace", "None", "return", "set", "sizeof", "static", "string", "struct",
  "switch", "True", "typedef", "using", "vector", "void", "while",
]);

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function tokenClass(token: string, lang: string): string | null {
  if (token.startsWith("//") || token.startsWith("/*") || (lang === "py" && token.startsWith("#"))) return "text-[var(--code-comment)]";
  if (token.startsWith("#")) return "text-[var(--code-preprocessor)]";
  if (token.startsWith("\"") || token.startsWith("'")) return "text-[var(--code-string)]";
  if (/^\d/.test(token)) return "text-[var(--code-number)]";
  if (KEYWORDS.has(token)) return "text-[var(--code-keyword)]";
  return null;
}

function highlightCode(code: string, lang: string) {
  const pattern = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of code.matchAll(pattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > last) out.push(code.slice(last, index));
    const cls = tokenClass(token, lang);
    out.push(cls ? <span key={i++} className={cls}>{token}</span> : token);
    last = index + token.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function plainText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return plainText((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

export function CheatSheetPage() {
  const { lang } = useParams<{ lang?: string }>();
  const navigate = useNavigate();
  const current: CheatLang = (lang === "c" || lang === "py" ? lang : "cpp");
  const [active, setActive] = useState<string | null>(null);

  const md = CHEATSHEET_SOURCES[current];
  const entries = useMemo(() => CHEAT_ENTRIES.filter((e) => e.lang === current), [current]);

  useEffect(() => {
    function onScroll() {
      let nextActive: string | null = null;
      for (const e of entries) {
        const el = document.getElementById(e.anchor);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 150) nextActive = e.anchor;
      }
      setActive(nextActive ?? entries[0]?.anchor ?? null);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [entries]);

  function copyCode(code: string, button: HTMLButtonElement) {
    void navigator.clipboard.writeText(code).then(
      () => { button.textContent = "Copied"; setTimeout(() => { button.textContent = "Copy"; }, 1500); },
      () => { button.textContent = "Failed"; setTimeout(() => { button.textContent = "Copy"; }, 1500); },
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 pt-32 pb-20">
      <div className="mb-4"><EyebrowLabel>Cheat sheet</EyebrowLabel></div>
      <h1 className="mb-6">Reference for {LANG_LABELS[current]}.</h1>

      <div className="mb-8 flex gap-2">
        {(Object.keys(LANG_LABELS) as CheatLang[]).map((l) => (
          <button
            key={l}
            onClick={() => navigate(`/cheatsheet/${l}`)}
            className={l === current
              ? "rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] px-5 py-1.5 text-sm font-medium"
              : "rounded-full border border-[var(--color-ink)] bg-white text-[var(--color-ink)] px-5 py-1.5 text-sm"}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      <div className="flex gap-12">
        <CheatSheetTOC entries={entries} activeAnchor={active} />
        <div className="prose prose-stone max-w-none flex-1 text-[var(--color-ink)] prose-p:my-3 prose-p:leading-7 [&_h2]:mt-14 [&_h2]:mb-3 [&_h2:first-child]:mt-0 [&_pre]:relative [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[24px] [&_pre]:border [&_pre]:border-[var(--color-dust)] [&_pre]:bg-[var(--code-bg)] [&_pre]:p-5 [&_pre]:pr-20 [&_code]:font-mono [&_code]:text-[13px] [&_code]:leading-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => {
                const text = String(children);
                const id = slugify(text);
                return <h2 id={id}>{children}</h2>;
              },
              pre: ({ children, ...rest }) => {
                const text = plainText(children);
                return (
                  <pre {...rest}>
                    <button
                      onClick={(e) => copyCode(text, e.currentTarget)}
                      className="absolute top-3 right-3 rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] px-3 py-0.5 text-[10px] font-medium text-[var(--color-ink)]"
                    >Copy</button>
                    {children}
                  </pre>
                );
              },
              code: ({ className, children, ...props }) => {
                const langMatch = /language-(\w+)/.exec(className ?? "");
                if (!langMatch) return <code className={className} {...props}>{children}</code>;
                const code = String(children).replace(/\n$/, "");
                return <code className={`${className ?? ""} text-[var(--code-text)]`} {...props}>{highlightCode(code, langMatch[1]!)}</code>;
              },
            }}
          >{md}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
