export function SatelliteCTA({ onClick, label = "Open" }: { onClick?: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="motion-press flex h-14 w-14 items-center justify-center rounded-full bg-white text-[var(--color-ink)] shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:bg-[var(--color-selection-tint)]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  );
}
