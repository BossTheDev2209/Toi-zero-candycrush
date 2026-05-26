import type { ReactNode } from "react";
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
  A1: "bg-[#F3F0EE] dark:bg-[#1A1815]",
  A2: "bg-[#ECE6DD] dark:bg-[#1F1C18]",
  A3: "bg-[#E3D9CB] dark:bg-[#23201B]",
};

export function SectionBand({ section, title, solved, total, milestone, height, children }: Props) {
  return (
    <section className={`relative rounded-[40px] ${BG[section]} px-6 pb-20 pt-10`} style={{ minHeight: height }}>
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
