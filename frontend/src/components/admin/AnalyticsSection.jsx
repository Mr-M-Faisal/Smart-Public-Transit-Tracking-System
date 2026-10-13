"use client";

import { BarChart3, TrendingUp, Users, DollarSign, Calendar } from "lucide-react";
import { Card } from "../common/Card";
import { EmptyState } from "../common/EmptyState";

import { SectionSkeleton } from "../common/SectionSkeleton";
export function AnalyticsSection({ bookingAnalytics = [], occupancyAnalytics = [], bookingLoading, occupancyLoading, bookingError, occupancyError, onRetry }) {
  return <div className="grid items-stretch gap-6 lg:grid-cols-2">
    <ChartState loading={bookingLoading} error={bookingError} title="Booking activity" retry={onRetry}><BookingChart bookingAnalytics={bookingAnalytics} /></ChartState>
    <ChartState loading={occupancyLoading} error={occupancyError} title="Route occupancy" retry={onRetry}><OccupancyChart occupancyAnalytics={occupancyAnalytics} /></ChartState>
  </div>;
}
function ChartState({ loading, error, title, retry, children }) {
  if (loading) return <SectionSkeleton variant="chart" count={1} label={'Loading ' + title} />;
  if (error) return <Card className="min-h-72 p-5" role="alert"><h2 className="font-bold">{title}</h2><p className="mt-3">Unable to load this chart.</p><button type="button" className="mt-3 underline" onClick={retry}>Retry</button></Card>;
  return children;
}
function BookingChart({ bookingAnalytics }) {
  // Calculate totals from bookingAnalytics
  const totalBookings7d = bookingAnalytics.reduce((acc, curr) => acc + (curr.totalBookings || 0), 0);
  const totalRevenue7d = bookingAnalytics.reduce((acc, curr) => acc + (curr.totalRevenue || 0), 0);
  const totalCancelled7d = bookingAnalytics.reduce((acc, curr) => acc + (curr.cancelled || 0), 0);
  const maxDailyBookings = Math.max(1, ...bookingAnalytics.map((d) => d.totalBookings || 0));

  return (<Card className="flex h-full flex-col justify-between p-5">
        <div>
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-[var(--primary-ink)]" />
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">
                  7-Day Booking Activity
                </h2>
                <p className="text-xs text-[var(--muted)]">Daily reservations and ticket volume</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[var(--primary-soft)] text-[var(--primary-ink)]">
              Last 7 Days
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--background)] p-3 text-center">
            <div>
              <p className="text-[11px] text-[var(--muted)]">Total Bookings</p>
              <p className="mt-0.5 text-lg font-bold text-[var(--foreground)]">{totalBookings7d}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">Total Revenue</p>
              <p className="mt-0.5 text-lg font-bold text-[var(--primary-ink)]">
                Rs. {totalRevenue7d.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">Cancelled</p>
              <p className="mt-0.5 text-lg font-bold text-[var(--danger)]">{totalCancelled7d}</p>
            </div>
          </div>

          {/* Daily Bar Chart */}
          {bookingAnalytics.length === 0 ? (
            <div className="py-8">
              <EmptyState
                title="No booking activity"
                description="No commuter bookings recorded in the past 7 days."
              />
            </div>
          ) : (
            <div className="mt-6 flex items-end justify-between gap-2 h-36 pt-4 px-2">
              {bookingAnalytics.map((day) => {
                const count = day.totalBookings || 0;
                const heightPct = Math.max(8, Math.round((count / maxDailyBookings) * 100));
                // format short date (e.g. "09/16")
                const shortDate = day._id ? day._id.slice(5) : "";

                return (
                  <div key={day._id} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <span className="text-[10px] font-bold text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {count}
                    </span>
                    <div className="w-full max-w-[32px] rounded-t-lg bg-[var(--primary-soft-strong)] group-hover:bg-[var(--primary)] transition-all relative flex items-end justify-center overflow-hidden"
                      style={{ height: `${heightPct}%` }}
                    >
                      <div className="w-full bg-[var(--primary)] rounded-t-lg" style={{ height: `${Math.min(100, heightPct)}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-[var(--muted)] truncate max-w-full">
                      {shortDate}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>);
}
function OccupancyChart({ occupancyAnalytics }) {
  return (<Card className="flex h-full flex-col justify-between p-5">
        <div>
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-[var(--primary-ink)]" />
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">
                  Route Occupancy Rate
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Average passenger load across active corridors
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[var(--primary-soft)] text-[var(--primary-ink)]">
              Fleet Average
            </span>
          </div>

          {occupancyAnalytics.length === 0 ? (
            <div className="py-8">
              <EmptyState
                title="No route occupancy data"
                description="Occupancy metrics will appear once buses are in operation."
              />
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[var(--border)] max-h-[300px] overflow-y-auto pr-1">
              {occupancyAnalytics.map((route) => {
                const occupancy = route.averageOccupancy ?? 0;
                return (
                  <div key={route.routeId || route.routeName} className="py-3 first:pt-1 last:pb-1">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[var(--foreground)] truncate max-w-[70%]">
                        {route.routeName}
                      </span>
                      <span className="font-bold text-[var(--foreground)]">
                        {occupancy}% avg
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-[var(--skeleton)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            occupancy > 80
                              ? "bg-[var(--danger)]"
                              : occupancy > 50
                              ? "bg-[var(--warning)]"
                              : "bg-[var(--primary)]"
                          }`}
                          style={{ width: `${Math.min(100, occupancy)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[var(--muted)] shrink-0">
                        {route.busCount} {route.busCount === 1 ? "bus" : "buses"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>);
}
