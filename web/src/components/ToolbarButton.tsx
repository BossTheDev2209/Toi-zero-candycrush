import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Toolbar action button with an icon + label and a clear three-tier hierarchy.
 * Replaces the old "row of six identical pills" with deliberate weight:
 *
 *  - primary : the frequent action (Run samples). Solid ink fill.
 *  - send    : the consequential action (Submit to TOI). Brand-signal fill so
 *              it reads as distinct and slightly cautionary — it fires a real
 *              irreversible submission.
 *  - ghost   : everything else (Import, Save, Download, Run all). No border,
 *              quiet until hovered, so the toolbar stops shouting.
 *
 * Interaction states are all designed (impeccable's "eight states"): hover
 * lift via .motion-press, a keyboard-only focus ring via :focus-visible, an
 * active press, and a disabled treatment. Mouse users never see the ring;
 * keyboard users always do.
 */
type ToolbarVariant = "primary" | "send" | "ghost";

const VARIANT: Record<ToolbarVariant, string> = {
  primary:
    "bg-[var(--color-ink)] text-[var(--color-canvas)] hover:bg-[color-mix(in_srgb,var(--color-ink)_90%,var(--color-signal))]",
  send:
    "bg-[var(--color-signal)] text-[var(--color-canvas)] hover:bg-[var(--color-signal-light)]",
  ghost:
    "bg-transparent text-[var(--color-graphite)] hover:bg-[var(--color-selection-tint)] hover:text-[var(--color-ink)]",
};

export function ToolbarButton({
  icon,
  variant = "ghost",
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: ToolbarVariant;
  children?: ReactNode;
}) {
  return (
    <button
      className={[
        "motion-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium leading-none tracking-[-0.01em]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANT[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon && <span className="shrink-0 text-[15px] leading-none [&_svg]:h-[15px] [&_svg]:w-[15px]">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
}
