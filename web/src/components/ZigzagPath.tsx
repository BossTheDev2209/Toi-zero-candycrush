import type { NodePoint } from "../lib/path-geometry";

export function ZigzagPath({ points, height }: { points: NodePoint[]; height: number }) {
  if (points.length < 2) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none" width="600" height={height} viewBox={`0 0 600 ${height}`} aria-hidden="true">
      {points.slice(0, -1).map((point, idx) => {
        const next = points[idx + 1]!;
        const bow = next.x > point.x ? 56 : -56;
        const d = [
          `M ${point.x} ${point.y + point.diameter / 2}`,
          `C ${point.x + bow} ${point.y + 58}, ${next.x + bow} ${next.y - 58}, ${next.x} ${next.y - next.diameter / 2}`,
        ].join(" ");
        return <path key={idx} d={d} fill="none" stroke="var(--color-signal-light)" strokeWidth="1.25" strokeLinecap="round" opacity="0.82" />;
      })}
    </svg>
  );
}
