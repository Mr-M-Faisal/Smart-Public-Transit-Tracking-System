import { cn } from "../../lib/utils/cn";

export function Select({ label, className, id, children, ...props }) {
  return <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)]" htmlFor={id}>{label}<select id={id} className={cn("h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft-strong)]", className)} {...props}>{children}</select></label>;
}
