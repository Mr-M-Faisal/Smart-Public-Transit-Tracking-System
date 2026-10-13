"use client";


import Link from "../common/SmartLink";
import { BusFront, ArrowUpRight, Gauge, MapPin, User, Users } from "lucide-react";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { CardBackdrop } from "../common/CardBackdrop";
import { EmptyState } from "../common/EmptyState";

const statusTones = {
  active: "success",
  idle: "warning",
  maintenance: "danger",
};

export function LiveTransitPanel({ buses = [], loading }) {
  if (loading) {
    return (
      <Card treatment="operational" className="flex h-full flex-col p-5 xl:min-h-[460px]">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="h-5 w-32 bg-[var(--skeleton)] rounded animate-pulse" />
          <div className="h-5 w-16 bg-[var(--skeleton)] rounded animate-pulse" />
        </div>
        <div className="mt-4 divide-y divide-[var(--border)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-4 space-y-2 animate-pulse">
              <div className="h-4 w-28 bg-[var(--skeleton)] rounded" />
              <div className="h-3 w-44 bg-[var(--skeleton)] rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const activeCount = buses.filter((b) => b.status === "active").length;

  return (
    <Card treatment="operational" className="flex h-full flex-col p-4 sm:p-5">
      <div className="premium-card premium-card--primary premium-card--imagery flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <CardBackdrop visual="fleet" />
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2">
            <BusFront size={18} className="text-[var(--primary-ink)]" />
            <h2 className="text-base font-bold text-[var(--foreground)]">Live Fleet Status</h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Real-time telemetry and capacity metrics
          </p>
        </div>
        <Badge tone={activeCount > 0 ? "success" : "neutral"} className="relative z-10 shrink-0">
          {activeCount} active
        </Badge>
      </div>

      {buses.length === 0 ? (
        <div className="grid flex-1 place-items-center py-8">
          <EmptyState
            title="No buses registered"
            description="No transit buses found in the fleet database."
          />
        </div>
      ) : (
        <div className="mt-3 max-h-[440px] flex-1 divide-y divide-[var(--border)] overflow-y-auto pr-1">
          {buses.map((bus) => {
            const busId = bus._id || bus.id;
            const routeName = bus.route?.routeName || bus.routeName || "Unassigned Route";
            const driverName = bus.driver?.name || "No driver assigned";
            const capacity = bus.capacity || 40;
            const availableSeats = bus.availableSeats ?? capacity;
            const occupiedSeats = Math.max(0, capacity - availableSeats);
            const occupancyPct = Math.round((occupiedSeats / capacity) * 100);
            const speed = bus.currentLocation?.speed != null ? Math.round(bus.currentLocation.speed) : null;

            return (
              <div key={busId} className="py-3.5 first:pt-2 last:pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span key={`${busId}-${bus.busNumber}`} className="live-transit-value font-bold text-sm text-[var(--foreground)]">
                        {bus.busNumber}
                      </span>
                      <Badge key={bus.status} tone={statusTones[bus.status] || "neutral"} className="live-transit-value text-[10px] px-1.5 py-0.5">
                        {bus.status || "idle"}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{routeName}</p>
                  </div>

                  <Link
                    href={`/buses/${busId}`}
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--primary-ink)] hover:text-[var(--primary-ink)] hover:underline"
                  >
                    Details <ArrowUpRight size={13} />
                  </Link>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                  <div className="flex items-center gap-1.5 truncate">
                    <User size={13} className="shrink-0 text-[var(--primary-ink)]" />
                    <span className="truncate">{driverName}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Gauge size={13} className="shrink-0 text-[var(--primary-ink)]" />
                    <span key={String(speed)} className="live-transit-value">{speed != null ? `${speed} km/h` : "Stationary"}</span>
                  </div>
                </div>

                {/* Capacity & Occupancy Bar */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)] mb-1">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} /> Occupancy
                    </span>
                    <span key={`${occupiedSeats}-${capacity}`} className="live-transit-value font-medium text-[var(--foreground)]">
                      {occupiedSeats} / {capacity} seats ({occupancyPct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[var(--skeleton)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        occupancyPct > 85
                          ? "bg-[var(--danger)]"
                          : occupancyPct > 60
                          ? "bg-[var(--warning)]"
                          : "bg-[var(--primary)]"
                      }`}
                      style={{ width: `${Math.min(100, occupancyPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto border-t border-[var(--border)] pt-3 text-center">
        <Link
          href="/admin/buses"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary-ink)] hover:text-[var(--primary-ink)] hover:underline"
        >
          Manage Fleet Buses & Operations →
        </Link>
      </div>
    </Card>
  );
}
