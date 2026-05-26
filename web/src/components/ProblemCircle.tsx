import { SatelliteCTA } from "./SatelliteCTA";
import { EyebrowLabel } from "./EyebrowLabel";

interface Props {
  title: string;
  category: string;
  status: "unsolved" | "attempted" | "solved";
  onOpen?: () => void;
  size?: number;
}

const STATUS_BG: Record<Props["status"], string> = {
  unsolved:  "bg-[var(--color-dust)]",
  attempted: "bg-[var(--color-signal-light)]/30",
  solved:    "bg-[var(--color-signal-light)]/60",
};

export function ProblemCircle({ title, category, status, onOpen, size = 280 }: Props) {
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <div className={`w-full h-full rounded-full ${STATUS_BG[status]} flex items-center justify-center`}>
          <span className="text-6xl text-[var(--color-ink)]/30 font-medium tracking-[-0.02em]">
            {title.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="absolute" style={{ bottom: -8, right: -8 }}>
          <SatelliteCTA onClick={onOpen} label={`Open ${title}`} />
        </div>
      </div>
      <div className="mt-6">
        <EyebrowLabel>{category}</EyebrowLabel>
      </div>
      <h3 className="mt-2 text-center text-[var(--color-ink)] line-clamp-2 px-4">{title}</h3>
    </div>
  );
}
