import type { CSSProperties, ReactNode } from "react";
import { EyebrowLabel } from "./EyebrowLabel";

interface Props {
  section: "A1" | "A2" | "A3";
  title: string;
  solved: number;
  total: number;
  milestone: string;
  height: number;
  children: ReactNode;
}

const BG: Record<Props["section"], string> = {
  A1: "var(--section-a1-bg)",
  A2: "var(--section-a2-bg)",
  A3: "var(--section-a3-bg)",
};

export function SectionBand({ section, title, solved, total, milestone, height, children }: Props) {
  return (
    <section
      className="section-band relative rounded-[40px] px-6 pb-20 pt-10"
      style={{ minHeight: height, "--section-bg": BG[section] } as CSSProperties}
    >
      <div className="mb-10 pl-2">
        <EyebrowLabel>{section} - {title}</EyebrowLabel>
        <p className="mt-2 text-sm text-[var(--color-slate)]">{solved} / {total} solved · {milestone}</p>
      </div>
      <div className="pointer-events-none absolute left-6 top-24 text-[96px] font-medium leading-none tracking-[-0.02em] text-[var(--color-whisper)]">
        {section}
      </div>
      {children}
    </section>
  );
}
