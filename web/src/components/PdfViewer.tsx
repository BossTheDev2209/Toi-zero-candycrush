export function PdfViewer({ problemId }: { problemId: number }) {
  return (
    <div className="h-full min-h-[520px] overflow-hidden rounded-[24px] border border-[var(--color-dust)]/50 bg-[#F7F4EF] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <iframe
        title="Problem statement PDF"
        src={`/api/problems/${problemId}/pdf#zoom=page-width`}
        className="h-full min-h-[520px] w-full"
        style={{ backgroundColor: "#FFFFFF" }}
      />
    </div>
  );
}
