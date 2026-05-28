import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
// Restrict highlight.js to the languages the user actually writes in TOI.
// Saves ~150 KB pre-gzip vs. the auto-loaded common-grammars set.
import cpp from "highlight.js/lib/languages/cpp";
import c from "highlight.js/lib/languages/c";
import python from "highlight.js/lib/languages/python";

const languages = { cpp, c, python };

/**
 * Extract plain text from React children (the highlighted code block tree).
 * Walks <code><span>token</span><span>token</span></code> recursively and joins
 * text nodes — the result is exactly what would render to the user, which is
 * what they want on the clipboard.
 */
function childrenToText(node: ReactNode): string {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return childrenToText(props?.children);
  }
  return "";
}

function CodeBlockPre({ children, ...rest }: { children?: ReactNode } & React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);
  const text = childrenToText(children);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can fail (insecure context, denied permission).
      // Swallow silently — the user's worst case is "click did nothing".
    }
  }
  return (
    <div className="md-code-shell relative group">
      <pre {...rest}>{children}</pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        className="md-code-copy absolute right-2 top-2 rounded-full border border-[var(--color-dust)] bg-[var(--color-canvas)] px-2.5 py-1 text-[10px] font-medium tracking-[0.01em] text-[var(--color-slate)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-[var(--color-ink)]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * Renders assistant markdown with syntax-highlighted code fences + a hover-
 * revealed Copy button on every code block.
 *
 * Theme: see `globals.css` — we map highlight.js's `.hljs-*` token classes to
 * the project's design tokens (--color-ink, --color-link, etc.) so the colors
 * stay consistent with the rest of the UI in both light and dark mode rather
 * than shipping the default github-dark stylesheet.
 */
export function MarkdownRender({ children }: { children: string }) {
  return (
    <div className="prose prose-stone max-w-none text-[var(--color-ink)] [&_pre]:bg-[var(--color-bone)] [&_pre]:rounded-2xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-[13px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { languages, detect: true, ignoreMissing: true }]]}
        components={{ pre: CodeBlockPre as any }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
