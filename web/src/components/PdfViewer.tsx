export function PdfViewer({ problemId }: { problemId: number }) {
  return (
    <div className="pdf-dark-frame h-full min-h-[520px] overflow-hidden rounded-[24px] border border-[var(--color-dust)]/50 bg-[var(--color-bone)]">
      <iframe
        title="Problem statement PDF"
        src={`/api/problems/${problemId}/pdf#zoom=page-width`}
        className="h-full min-h-[520px] w-full"
      />
    </div>
  );
}
