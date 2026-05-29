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
