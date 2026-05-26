export type ProblemSection = "A1" | "A2" | "A3";

const SIZES: Record<ProblemSection, { base: number; growth: number }> = {
  A1: { base: 88, growth: 12 },
  A2: { base: 100, growth: 16 },
  A3: { base: 116, growth: 24 },
};

export function problemSection(category: string): ProblemSection {
  if (category.toUpperCase().startsWith("A2")) return "A2";
  if (category.toUpperCase().startsWith("A3")) return "A3";
  return "A1";
}

export function nodeDiameter(section: ProblemSection, idx: number, total: number): number {
  const { base, growth } = SIZES[section];
  const ratio = total <= 1 ? 0 : idx / (total - 1);
  return Math.round(base + ratio * growth);
}

export function nodeOffset(idx: number, swing = 200): number {
  return Math.sin((idx / 4) * Math.PI) * swing;
}

export interface NodePoint {
  x: number;
  y: number;
  diameter: number;
}

export function nodePoint(section: ProblemSection, idx: number, total: number, centerX = 300, rowGap = 132): NodePoint {
  const diameter = nodeDiameter(section, idx, total);
  return {
    x: centerX + nodeOffset(idx),
    y: 92 + idx * rowGap,
    diameter,
  };
}
