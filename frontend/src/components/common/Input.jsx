import { cn } from "../../lib/utils/cn";

export function Input({ label, error, className, id, ...props }) {
  return <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)]" htmlFor={id}>
    {label}
    <input id={id} className={cn("h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft-strong)]", error && "border-[var(--danger)]", className)} {...props} />
    {error && <span className="text-xs font-normal text-[var(--danger)]">{error}</span>}
  </label>;
}
