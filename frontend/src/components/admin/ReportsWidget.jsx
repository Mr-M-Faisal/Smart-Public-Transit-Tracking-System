"use client";

import Link from "../common/SmartLink";
import { useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle, Clock, ShieldAlert, Wrench } from "lucide-react";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { CardBackdrop } from "../common/CardBackdrop";
import { EmptyState } from "../common/EmptyState";

const statusTones = {
  open: "danger",
  reviewed: "warning",
  resolved: "success",
};

export function ReportsWidget({ reports = [], reportsSummary, loading }) {
  const [filter, setFilter] = useState("all");

  if (loading) {
    return (
      <Card treatment="operational" className="h-full p-5 animate-pulse">
        <div className="h-5 w-48 bg-[var(--skeleton)] rounded mb-4" />
        <div className="h-40 bg-[var(--skeleton)] rounded" />
      </Card>
    );
  }

  // Summary counts
  const openCount = reportsSummary?.byStatus?.find((s) => s._id === "open")?.count ?? 0;
  const reviewedCount = reportsSummary?.byStatus?.find((s) => s._id === "reviewed")?.count ?? 0;
  const resolvedCount = reportsSummary?.byStatus?.find((s) => s._id === "resolved")?.count ?? 0;
  const safetyCount = reportsSummary?.byType?.find((t) => t._id === "safety")?.count ?? 0;
  const conditionCount = reportsSummary?.byType?.find((t) => t._id === "condition")?.count ?? 0;

  const filteredReports = reports.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  return (
    <Card treatment="operational" className="h-full p-5">
      {/* Header */}
      <div className="premium-card premium-card--primary premium-card--imagery flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <CardBackdrop visual="reports" />
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-[var(--primary-ink)]" />
            <h2 className="text-base font-bold text-[var(--foreground)]">
              Safety & Incident Reports
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Latest 20 reports. Filters apply to this recent list.
          </p>
        </div>

        {/* Summary Badges */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--danger-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--danger)]">
            <AlertOctagon size={13} /> {openCount} Open
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--warning-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--warning)]">
            <Clock size={13} /> {reviewedCount} Reviewed
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
            <CheckCircle size={13} /> {resolvedCount} Resolved
          </span>
        </div>
      </div>

      <Link href="/admin/reports" className="mt-3 inline-block text-sm underline">View all reports</Link>
      {/* Filter Tabs */}
      <div className="mt-4 flex flex-wrap gap-2 border-b border-[var(--border)] pb-2 text-xs">
        {["all", "open", "reviewed", "resolved"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`min-h-11 rounded-lg px-3 py-1.5 font-semibold capitalize transition ${
              filter === tab
                ? "bg-[var(--primary)] text-[var(--primary-contrast)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="py-8">
          <EmptyState
            title="No reports match this filter"
            description="No commuter or safety reports found under the selected status."
          />
        </div>
      ) : (
        <div className="mt-3 divide-y divide-[var(--border)] max-h-[360px] overflow-y-auto pr-1">
          {filteredReports.map((report) => {
            const isSafety = report.reportType === "safety";
            const dateStr = report.createdAt
              ? new Date(report.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Date unknown";

            return (
              <div key={report._id} className="py-3.5 first:pt-2 last:pb-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={`mt-0.5 rounded-lg p-1.5 ${
                        isSafety ? "bg-[var(--danger-soft)] text-[var(--danger)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"
                      }`}
                    >
                      {isSafety ? <AlertTriangle size={15} /> : <Wrench size={15} />}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                          {isSafety ? "Safety Issue" : "Vehicle Condition"}
                        </span>
                        {report.bus?.busNumber && (
                          <span className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--primary-ink)]">
                            Bus {report.bus.busNumber}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 break-words text-sm text-[var(--foreground)]">{report.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                        <span>Reported by: <strong>{report.user?.name || "Commuter"}</strong></span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  <Badge tone={statusTones[report.status] || "neutral"}>
                    {report.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
