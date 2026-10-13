import Link from "../common/SmartLink";
import { BusFront, Clock3, MapPin, Users } from "lucide-react";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";

const occupancyTone = { Available: "success", Limited: "warning", Full: "danger" };

export function BusCard({ bus }) {
  const operating = bus.status === "active" || bus.status === "Active" || ["On Time", "Delayed", "Arriving"].includes(bus.status);
  const liveDetails = [
    !bus.isSaved && bus.eta && { icon: Clock3, label: "ETA", value: bus.eta },
    !bus.isSaved && bus.nextStop && { icon: MapPin, label: "Next", value: bus.nextStop },
    !bus.isSaved && (bus.occupancy || bus.availableSeats != null) && { icon: Users, label: "Seats", value: bus.occupancy || `${bus.availableSeats} available`, tone: occupancyTone[bus.occupancy] || "neutral" },
  ].filter(Boolean);

  return <Link href={`/buses/${bus.id}`} className="block">
    <Card treatment="operational" className="bus-card group overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.1)]">
      <div className="flex min-w-0">
        <div className="grid h-[104px] w-[96px] shrink-0 place-items-center border-r border-[var(--border)] bg-[var(--primary-soft)] p-3 sm:w-[108px]" aria-hidden="true">
          <BusFront size={42} strokeWidth={2.25} className="text-[var(--primary-ink)]" />
        </div>
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-[11px] font-extrabold uppercase tracking-[0.11em] text-[var(--primary-ink)]">{bus.routeName || bus.route || "Transit route"}</p>
            <Badge tone={operating ? "success" : "neutral"}>{bus.isSaved ? "Last known" : operating ? "Live" : "Off"}</Badge>
          </div>
          <h3 className="mt-1 text-base font-bold leading-tight text-[var(--foreground)]">{bus.number || bus.busNumber}</h3>
          {bus.directionLabel && <p className="mt-1 truncate text-xs font-medium text-[var(--muted)]">{bus.directionLabel}</p>}
          {operating && liveDetails.length ? <div className="mt-2 flex min-w-0 gap-3 border-t border-[var(--border)] pt-2">{liveDetails.slice(0, 2).map((detail) => <Info key={detail.label} {...detail} />)}</div> : <p className="mt-2 border-t border-[var(--border)] pt-2 text-xs leading-4 text-[var(--muted)]">{operating ? "Live trip details are not available yet." : "Live trip details are available when this bus is operating."}</p>}
        </div>
      </div>
    </Card>
  </Link>;
}

function Info({ icon: Icon, label, value, tone }) {
  return <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)]"><Icon size={13} className="shrink-0 text-[var(--primary-ink)]" /><span className="sr-only">{label}: </span>{tone ? <Badge tone={tone}>{value}</Badge> : <strong className="truncate font-semibold text-[var(--foreground)]">{value}</strong>}</span>;
}
