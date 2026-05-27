import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CHEAT_ENTRIES, CHEATSHEET_SOURCES, type CheatLang } from "../data/cheatsheet/meta";
import { CheatSheetTOC } from "../components/CheatSheetTOC";
import { EyebrowLabel } from "../components/EyebrowLabel";

const LANG_LABELS: Record<CheatLang, string> = { cpp: "C++", c: "C", py: "Python" };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
        <div className="prose prose-stone max-w-none flex-1 text-[var(--color-ink)] [&_pre]:relative [&_pre]:bg-[var(--color-bone)] [&_pre]:rounded-2xl [&_pre]:p-4 [&_code]:font-mono [&_code]:text-[13px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => {
                const text = String(children);
                const id = slugify(text);
                return <h2 id={id}>{children}</h2>;
              },
              pre: ({ children, ...rest }) => {
                const codeEl = (children as any)?.props?.children;
                const text = typeof codeEl === "string" ? codeEl : "";
                return (
                  <pre {...rest}>
                    <button
                      onClick={(e) => copyCode(text, e.currentTarget)}
                      className="absolute top-2 right-2 rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] px-3 py-0.5 text-[10px] font-medium text-[var(--color-ink)]"
                    >Copy</button>
                    {children}
                  </pre>
                );
              },
            }}
          >{md}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
