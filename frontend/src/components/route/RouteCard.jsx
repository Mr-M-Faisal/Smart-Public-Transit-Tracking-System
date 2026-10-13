
import Link from "../common/SmartLink";
import { BusFront, ArrowRight, CircleDot, MapPinned } from "lucide-react";
import { Card } from "../common/Card";

export function RouteCard({ route, className = "" }) {
  const routeId = route._id || route.id || route.number;
  const routeName = route.routeName || route.name || "Transit route";
  const start = route.startPoint || route.start;
  const end = route.endPoint || route.end;
  const stopCount = Number.isFinite(route.stops) ? route.stops : Array.isArray(route.stops) ? route.stops.length : null;
  const activeBuses = Number.isFinite(route.activeBuses) ? route.activeBuses : null;
  const isActive = activeBuses != null ? activeBuses > 0 : route.isActive === true;
  const showStatus = activeBuses != null || typeof route.isActive === "boolean";
  const stats = [
    stopCount != null && { label: `${stopCount} ${stopCount === 1 ? "stop" : "stops"}`, icon: MapPinned },
    activeBuses != null && { label: `${activeBuses} active`, icon: BusFront },
  ].filter(Boolean);

  return <Card treatment="operational" className={`route-card flex h-full min-w-0 flex-col p-4 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <h3 className="min-w-0 text-base font-bold leading-5 text-[var(--foreground)]">{routeName}</h3>
      {showStatus && <span className={`route-card-status inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${isActive ? "is-active text-[var(--success)]" : "text-[var(--muted)]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{isActive ? "Active" : "Inactive"}</span>}
    </div>
    {(start || end) && <div className="route-card-journey mt-4 flex min-w-0 items-center gap-2 text-sm">
      <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-[var(--foreground)]"><CircleDot size={15} className="shrink-0 text-[var(--primary-ink)]" /><span className="truncate">{start || "Start unavailable"}</span></span>
      <span className="h-px min-w-3 flex-1 bg-[var(--primary-border)]" aria-hidden="true" />
      <ArrowRight size={15} className="shrink-0 text-[var(--primary-ink)]" aria-hidden="true" />
      <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-[var(--foreground)]"><MapPinned size={15} className="shrink-0 text-[var(--primary-ink)]" /><span className="truncate">{end || "Destination unavailable"}</span></span>
    </div>}
    {stats.length > 0 && <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3">{stats.map(({ label, icon: Icon }) => <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"><Icon size={14} className="text-[var(--primary-ink)]" />{label}</span>)}</div>}
    <div className="mt-4 border-t border-[var(--border)] pt-3 text-center"><Link href={`/routes/${routeId}`} className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-[var(--primary-ink)] transition hover:translate-x-0.5 hover:text-[var(--primary-dark)]">View route <ArrowRight size={15} /></Link></div>
  </Card>;
}
