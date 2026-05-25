export default function App() {
  return (
    <div className="min-h-screen p-16">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-signal-light)]" />
        <span className="text-[14px] font-bold tracking-[0.04em] uppercase">SCAFFOLD</span>
      </div>
      <h1 className="mb-8">TOIZero design tokens are live.</h1>
      <div className="flex gap-4">
        <button className="bg-[var(--color-ink)] text-[var(--color-canvas)] rounded-[20px] px-6 py-1.5 font-medium">
          Primary
        </button>
        <button className="bg-white text-[var(--color-ink)] rounded-[20px] px-6 py-1.5 font-[450] border-[1.5px] border-[var(--color-ink)]">
          Secondary
        </button>
        <button className="bg-[var(--color-signal)] text-white rounded-[24px] px-7 py-1 text-[13px]">
          Consent
        </button>
      </div>
    </div>
  );
}
