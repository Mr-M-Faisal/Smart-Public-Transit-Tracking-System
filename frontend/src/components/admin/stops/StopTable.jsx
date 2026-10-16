"use client";

import { Edit3, MapPin, Trash2 } from "lucide-react";
import { Card } from "../../common/Card";
import { EmptyState } from "../../common/EmptyState";

export function StopTable({ stops, loading, onEdit, onDelete, onAddClick }) {
  if (loading) {
    return (
      <Card className="p-5">
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-48 bg-[var(--skeleton)] rounded" />
          {[1, 2, 3].map((i) => <div key={i} className="h-12 w-full bg-[var(--skeleton)] rounded-xl" />)}
        </div>
      </Card>
    );
  }

  if (stops.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState
          title="No stops found"
          description="No stops matched your search, or no stops have been created yet."
          action={
            onAddClick && (
              <button type="button" onClick={onAddClick} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]">
                Add First Stop
              </button>
            )
          }
        />
      </Card>
    );
  }

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden xl:block overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <table className="min-w-full divide-y divide-[var(--border)] text-left">
          <thead className="bg-[var(--background)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-5 py-3.5">Order</th>
              <th scope="col" className="px-4 py-3.5">Stop Name</th>
              <th scope="col" className="px-4 py-3.5">Route</th>
              <th scope="col" className="px-4 py-3.5">Coordinates</th>
              <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] text-sm">
            {stops.map((stop) => {
              const stopId = stop.routeStopId || `${stop._id || stop.id}:${stop.route?._id || stop.route?.id || stop.route}`;
              return (
                <tr key={stopId} className="hover:bg-[var(--background)] transition-colors">
                  <td className="px-5 py-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary-ink)]">
                      {stop.stopOrder}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={15} className="text-[var(--primary-ink)] shrink-0" />
                      <span className="font-semibold text-[var(--foreground)]">{stop.stopName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-[var(--muted)]">{stop._routeName || "—"}</span>
                  </td>
                  <td className="px-4 py-4">
                    {stop.latitude != null ? (
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => onEdit(stop)} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)] transition" title="Edit stop" aria-label={`Edit ${stop.stopName}`}>
                        <Edit3 size={16} />
                      </button>
                      <button type="button" onClick={() => onDelete(stop)} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition" title="Delete stop" aria-label={`Delete ${stop.stopName}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-3 xl:hidden">
        {stops.map((stop) => {
          const stopId = stop.routeStopId || `${stop._id || stop.id}:${stop.route?._id || stop.route?.id || stop.route}`;
          return (
            <Card key={stopId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary-ink)]">
                    {stop.stopOrder}
                  </span>
                  <div>
                    <p className="font-bold text-[var(--foreground)]">{stop.stopName}</p>
                    <p className="text-xs text-[var(--muted)]">{stop._routeName}</p>
                  </div>
                </div>
              </div>
              {stop.latitude != null && (
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                  📍 {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                </p>
              )}
              <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
                <button type="button" onClick={() => onEdit(stop)} className="flex-1 min-h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--primary-ink)] hover:bg-[var(--primary-soft)] transition">
                  <Edit3 size={13} /> Edit
                </button>
                <button type="button" onClick={() => onDelete(stop)} className="flex-1 min-h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#f4cccc] text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] transition">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
