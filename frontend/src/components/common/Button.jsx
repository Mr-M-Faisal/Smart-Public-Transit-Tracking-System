import { cn } from "../../lib/utils/cn";

const variants = {
  primary: "bg-[var(--primary)] text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]",
  secondary: "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--primary-soft)]",
  ghost: "text-[var(--primary-ink)] hover:bg-[var(--primary-soft)]",
  danger: "bg-[var(--danger)] text-[var(--danger-contrast)] hover:brightness-95",
};

export function Button({ className, variant = "primary", ...props }) {
  return <button className={cn("ui-button inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed", variants[variant], className)} {...props} />;
}
