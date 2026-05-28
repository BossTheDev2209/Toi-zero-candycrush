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
 * Renders assistant markdown with syntax-highlighted code fences.
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
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
