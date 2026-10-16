"use client";


import Link from "../../common/SmartLink";
import { BusFront, ArrowUpRight, Edit3, Eye, MapPin, Trash2 } from "lucide-react";
import { Badge } from "../../common/Badge";
import { Card } from "../../common/Card";
import { EmptyState } from "../../common/EmptyState";

export function RouteTable({ routes, loading, busesPerRoute, onEdit, onDelete, onPreview, onAddClick }) {
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

  if (routes.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState
          title="No routes found"
          description="No transit routes matched your search, or no routes have been created yet."
          action={
            onAddClick && (
              <button
                type="button"
                onClick={onAddClick}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]"
              >
                Add First Route
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
              <th scope="col" className="px-5 py-3.5">Route</th>
              <th scope="col" className="px-4 py-3.5">Origin → Destination</th>
              <th scope="col" className="px-4 py-3.5">Description</th>
              <th scope="col" className="px-4 py-3.5">Buses</th>
              <th scope="col" className="px-4 py-3.5">Status</th>
              <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] text-sm">
            {routes.map((route) => {
              const routeId = route._id || route.id;
              const busCount = busesPerRoute[routeId] || 0;
              return (
                <tr key={routeId} className="hover:bg-[var(--background)] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
                        <MapPin size={16} />
                      </span>
                      <span className="font-semibold text-[var(--foreground)]">{route.routeName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-[var(--foreground)]">
                      <span>{route.startPoint}</span>
                      <span className="mx-1.5 text-[var(--muted)]">→</span>
                      <span>{route.endPoint}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 max-w-[200px]">
                    <p className="text-xs text-[var(--muted)] line-clamp-2">{route.description || "—"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <BusFront size={14} className="text-[var(--muted)]" />
                      <span className="text-sm font-medium text-[var(--foreground)]">{busCount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone="success">Active</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onPreview(route)}
                        className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)] transition"
                        title="Preview stops and map"
                        aria-label={`Preview ${route.routeName}`}
                      >
                        <Eye size={16} />
                      </button>
                      <Link
                        href={`/routes/${routeId}`}
                        className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)] transition"
                        title="View public route page"
                        aria-label={`View public page for ${route.routeName}`}
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit(route)}
                        className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)] transition"
                        title="Edit route"
                        aria-label={`Edit ${route.routeName}`}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(route)}
                        className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition"
                        title="Delete route"
                        aria-label={`Delete ${route.routeName}`}
                      >
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
        {routes.map((route) => {
          const routeId = route._id || route.id;
          const busCount = busesPerRoute[routeId] || 0;
          return (
            <Card key={routeId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
                    <MapPin size={18} />
                  </span>
                  <div>
                    <p className="font-bold text-[var(--foreground)]">{route.routeName}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {route.startPoint} → {route.endPoint}
                    </p>
                  </div>
                </div>
                <Badge tone="success">Active</Badge>
              </div>

              {route.description && (
                <p className="mt-3 text-xs text-[var(--muted)]">{route.description}</p>
              )}

              <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <BusFront size={13} /> {busCount} {busCount === 1 ? "bus" : "buses"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
                <button
                  type="button"
                  onClick={() => onPreview(route)}
                  className="flex-1 min-h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--primary-soft)] transition"
                >
                  <Eye size={14} /> Preview
                </button>
                <Link
                  href={`/routes/${routeId}`}
                  className="flex-1 min-h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--primary-soft)] transition"
                >
                  <ArrowUpRight size={14} /> Public Page
                </Link>
                <button
                  type="button"
                  onClick={() => onEdit(route)}
                  className="flex-1 min-h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--primary-ink)] hover:bg-[var(--primary-soft)] transition"
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(route)}
                  className="flex-1 min-h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#f4cccc] text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] transition"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
