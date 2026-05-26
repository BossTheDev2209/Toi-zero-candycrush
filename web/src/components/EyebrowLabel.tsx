export function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-signal-light)]" />
      <span className="text-[14px] font-bold tracking-[0.04em] uppercase text-[var(--color-ink)]">
        {children}
      </span>
    </div>
  );
}
