import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "consent";

const STYLES: Record<Variant, string> = {
  primary:   "bg-[var(--color-ink)] text-[var(--color-canvas)] border-[1.5px] border-[var(--color-ink)] rounded-[20px] px-6 py-1.5 font-medium tracking-[-0.02em]",
  secondary: "bg-white text-[var(--color-ink)] border-[1.5px] border-[var(--color-ink)] rounded-[20px] px-6 py-1.5 font-[450]",
  consent:   "bg-[var(--color-signal)] text-white rounded-[24px] px-7 py-1 text-[13px]",
};

export function PillButton(
  { variant = "primary", children, className = "", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }
) {
  return (
    <button className={`${STYLES[variant]} disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.98] ${className}`} {...rest}>
      {children}
    </button>
  );
}
