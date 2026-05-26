import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRender({ children }: { children: string }) {
  return (
    <div className="prose prose-stone max-w-none text-[var(--color-ink)] [&_pre]:bg-[var(--color-bone)] [&_pre]:rounded-2xl [&_pre]:p-4 [&_code]:font-mono [&_code]:text-[13px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
