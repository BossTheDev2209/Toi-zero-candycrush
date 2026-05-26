export function OrbitalArc({ width = 400, height = 80, className = "" }: { width?: number; height?: number; className?: string }) {
  const d = `M 0 ${height - 8} Q ${width / 2} -${height * 0.4} ${width} ${height - 8}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={d} stroke="var(--color-signal-light)" strokeWidth="1.25" fill="none" strokeLinecap="round" />
    </svg>
  );
}
