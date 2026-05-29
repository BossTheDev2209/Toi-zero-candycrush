import type { SVGProps } from "react";

/**
 * Small, consistent inline icon set for toolbars and nav. All icons share a
 * 24×24 viewBox, round caps/joins, and 1.75 stroke so they read evenly at the
 * ~15px sizes used in buttons. Stroke uses currentColor so they inherit the
 * button's text color across themes; the two "play" glyphs are filled.
 *
 * Sizing: pass a Tailwind size via className (e.g. "h-[15px] w-[15px]") or rely
 * on the 1em default so they scale with font-size.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Cloud with a down arrow — pulling code down from TOI (remote). */
export function IconCloudDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 17.5a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.4 9a3.5 3.5 0 0 1 .1 8.5" />
      <path d="M12 11v7" />
      <path d="m9 15.5 3 3 3-3" />
    </Svg>
  );
}

/** Floppy disk — Save. */
export function IconSave(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M8 4v5h7" />
      <rect x="8" y="13.5" width="8" height="5.5" rx="0.6" />
    </Svg>
  );
}

/** Arrow down into a tray — Download to disk. */
export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}

/** Filled play triangle — Run samples (primary action). */
export function IconPlay(props: IconProps) {
  return (
    <Svg fill="currentColor" stroke="none" {...props}>
      <path d="M7 5.2c0-.6.65-.97 1.16-.66l11 6.8a.78.78 0 0 1 0 1.32l-11 6.8A.78.78 0 0 1 7 18.8z" />
    </Svg>
  );
}

/** Double play / fast-forward — Run all tests. */
export function IconRunAll(props: IconProps) {
  return (
    <Svg fill="currentColor" stroke="none" {...props}>
      <path d="M4 6c0-.55.6-.88 1.06-.58l8 6a.7.7 0 0 1 0 1.16l-8 6A.7.7 0 0 1 4 18z" />
      <path d="M13 6c0-.55.6-.88 1.06-.58l8 6a.7.7 0 0 1 0 1.16l-8 6A.7.7 0 0 1 13 18z" />
    </Svg>
  );
}

/** Paper plane — Submit (send to TOI). */
export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.4 21a.5.5 0 0 1-.93.05L10.5 13.5 3.0 10.46a.5.5 0 0 1 .05-.94z" />
    </Svg>
  );
}

/** Lightbulb-ish brain — toggles model reasoning ("thinking"). */
export function IconBrain(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.6A3 3 0 0 0 6 17a3 3 0 0 0 3 3z" />
      <path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.6A3 3 0 0 1 18 17a3 3 0 0 1-3 3z" />
      <path d="M12 3.5v17" />
    </Svg>
  );
}

/** Globe — reply language selector. */
export function IconGlobe(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 2.5 15 0 18-2.5-3-2.5-15 0-18z" />
    </Svg>
  );
}

/** Pop-out / float — detach the panel into a floating window. */
export function IconPopOut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </Svg>
  );
}

/** Dock to the right edge. */
export function IconDockRight(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </Svg>
  );
}

/** Minimize — collapse the panel to a bubble. */
export function IconMinimize(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

/** Chat bubble — the minimized AI Help launcher. */
export function IconChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
    </Svg>
  );
}

/** Gear — settings. */
export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Svg>
  );
}
