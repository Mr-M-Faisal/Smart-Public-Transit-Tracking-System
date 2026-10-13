export function SectionSkeleton({ label = "Loading content", variant = "cards", count = 3, className = "" }) {
  return <div role="status" aria-live="polite" aria-busy="true" className={className}>
    <span className="sr-only">{label}</span>
    {variant === "map" ? <div aria-hidden="true" className="min-h-[360px] h-full rounded-2xl border border-[var(--border)] bg-[var(--skeleton)] motion-safe:animate-pulse" /> :
      <div aria-hidden="true" className={variant === "stats" ? "grid grid-cols-2 gap-4 lg:grid-cols-4" : "grid gap-4"}>
        {Array.from({ length: count }, (_, index) => <div key={index} className={"rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 motion-safe:animate-pulse " + (variant === "chart" ? "min-h-72" : variant === "rows" ? "min-h-20" : "min-h-32")}>
          <div className="h-4 w-1/3 rounded bg-[var(--skeleton)]" /><div className="mt-4 h-5 w-2/3 rounded bg-[var(--skeleton)]" />
          {variant !== "rows" && <div className="mt-3 h-4 w-1/2 rounded bg-[var(--skeleton)]" />}
        </div>)}
      </div>}
  </div>;
}
export function PageSkeleton({ title = "Smart Safar", variant = "cards" }) {
  return <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" aria-label={title}>
    <h1 className="text-2xl font-bold">{title}</h1>
    <SectionSkeleton label={"Loading " + title} variant={variant} className="mt-6" />
  </section>;
}
