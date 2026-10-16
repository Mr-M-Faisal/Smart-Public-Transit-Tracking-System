"use client";

import Link from "../../common/SmartLink";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  MapPin,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Navbar } from "../../navigation/Navbar";
import { Footer } from "../../navigation/Footer";
import { Button } from "../../common/Button";
import { Card } from "../../common/Card";
import { CardBackdrop } from "../../common/CardBackdrop";
import { CompactPageSearch } from "../CompactPageSearch";
import { PageSkeleton } from "../../common/SectionSkeleton";
import { useAuth } from "../../../hooks/useAuth";
import { getProfile } from "../../../services/authService";
import { stopService } from "../../../services/stopService";
import { clearAccessToken } from "../../../lib/auth/token";
import { StopTable } from "./StopTable";
import { AddStopModal } from "./AddStopModal";
import { EditStopModal } from "./EditStopModal";
import { DeleteStopModal } from "./DeleteStopModal";

export default function StopManagementPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStop, setEditingStop] = useState(null);
  const [deletingStop, setDeletingStop] = useState(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") === "add") {
      queueMicrotask(() => setIsAddOpen(true));
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setError("");
    try {
      const user = await getProfile();
      if (user.role !== "admin") {
        setProfile(user);
        setError("unauthorized");
        setLoading(false);
        return;
      }
      setProfile(user);

      const groups = await stopService.listGrouped();
      setRoutes(groups.map((group) => group.route));
      const allStops = groups.flatMap(({ route, stops }) => stops.map((stop) => ({ ...stop, _routeName: route.routeName })));
      setStops(allStops);
    } catch (err) {
      console.error("Stop management load error", err);
      if ([401, 403].includes(err.response?.status)) {
        setError(err.response.status === 403 ? "unauthorized" : "auth");
      } else {
        setError("load");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) loadData(); });
    return () => { active = false; };
  }, [loadData]);

  const filteredStops = useMemo(() => {
    let result = stops;

    if (selectedRouteId !== "all") {
      result = result.filter((s) => {
        const rId = s.route?._id || s.route?.id || s.route;
        return rId?.toString() === selectedRouteId;
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((s) => s.stopName?.toLowerCase().includes(q));
    }

    return result;
  }, [stops, selectedRouteId, searchTerm]);

  function handleCreated(newStop) {
    setMessage("Stop created.");
    const route = routes.find((r) => (r._id || r.id) === (newStop.route?._id || newStop.route?.id || newStop.route));
    setStops((prev) => [...prev, { ...newStop, _routeName: route?.routeName || "Unknown" }]);
  }

  function handleUpdated(updatedStop) {
    setMessage("Stop updated.");
    setStops((prev) =>
      prev.map((s) => {
        const samePhysicalStop = (s._id || s.id) === (updatedStop._id || updatedStop.id);
        const sameAssignment = (s.routeStopId && s.routeStopId === updatedStop.routeStopId) ||
          (!s.routeStopId && samePhysicalStop);
        if (sameAssignment) {
          const route = routes.find((r) => (r._id || r.id) === (updatedStop.route?._id || updatedStop.route?.id || updatedStop.route));
          return { ...updatedStop, _routeName: route?.routeName || s._routeName };
        }
        if (samePhysicalStop) {
          return { ...s, stopName: updatedStop.stopName, latitude: updatedStop.latitude, longitude: updatedStop.longitude, location: updatedStop.location };
        }
        return s;
      })
    );
  }

  function handleDeleted(deletedAssignment) {
    setStops((prev) => prev.filter((s) =>
      (s.routeStopId || `${s._id || s.id}:${s.route?._id || s.route?.id || s.route}`) !== deletedAssignment
    ));
  }

  if (authLoading || (loading && !profile && !error)) {
    return (
      <PageShell>
        <PageSkeleton title="Stop management" variant="rows" />
      </PageShell>
    );
  }

  if (!isAuthenticated || error === "auth") {
    return (
      <PageShell>
        <Card treatment="operational" className="mx-auto max-w-lg p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
            <ShieldAlert size={26} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[var(--foreground)]">Sign In Required</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            You must be signed in as an administrator to manage stops.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link href="/login?redirect=/admin/stops" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]">
              Sign In as Admin
            </Link>
            <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]">
              Back to Home
            </Link>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (error === "unauthorized") {
    return (
      <PageShell>
        <Card treatment="operational" className="mx-auto max-w-lg p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
            <AlertTriangle size={26} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[var(--foreground)]">Admin Access Required</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Administrator privileges are required to manage stops.
          </p>
          <div className="mt-6">
            <button type="button" onClick={() => { clearAccessToken(); router.replace("/login?redirect=/admin/stops"); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]">
              Switch Account
            </button>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (error === "load") {
    return (
      <PageShell>
        <Card treatment="operational" className="mx-auto max-w-lg p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
            <AlertTriangle size={26} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[var(--foreground)]">Unable to Load Stops</h1>
          <div className="mt-6">
            <Button type="button" onClick={loadData} className="gap-2"><RefreshCw size={15} /> Try Again</Button>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-4">
        <Link href="/admin/dashboard" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--primary-ink)] hover:border-[var(--primary)] transition" aria-label="Back to Admin Dashboard" title="Back to Admin Dashboard"><ArrowLeft size={16} /></Link>
      </div>

      <header className="premium-dashboard-header premium-card premium-card--primary premium-card--imagery flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
        <CardBackdrop visual="stops" priority />
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Transit Network</p>
            <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--primary-ink)]">
              {stops.length} Stops
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Stop Management
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Manage transit stops, coordinates, and route associations.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <CompactPageSearch label="Search stops" placeholder="Stop name" value={searchTerm} onChange={setSearchTerm} />
          <Button type="button" variant="secondary" className="gap-2 text-xs" onClick={() => { setRefreshing(true); loadData(); }} disabled={refreshing} aria-label="Refresh stops">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button type="button" className="gap-1.5 text-xs" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Add Stop
          </Button>
        </div>
      </header>

      {message && <p role="status" className="mt-4 text-sm text-[var(--success)]">{message}</p>}

      {/* Filters */}
      <Card treatment="operational" className="mt-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="field-input text-sm min-w-[180px]"
            aria-label="Filter by route"
          >
            <option value="all">All Routes ({stops.length})</option>
            {routes.map((r) => {
              const rId = r._id || r.id;
              const count = stops.filter((s) => {
                const sid = s.route?._id || s.route?.id || s.route;
                return sid?.toString() === rId?.toString();
              }).length;
              return <option key={rId} value={rId}>{r.routeName} ({count})</option>;
            })}
          </select>
        </div>
      </Card>

      <div className="mt-4 text-sm text-[var(--muted)]">
        Showing <strong className="text-[var(--foreground)]">{filteredStops.length}</strong> of {stops.length} stops
      </div>

      <div className="mt-4">
        <StopTable
          stops={filteredStops}
          loading={loading}
          onEdit={setEditingStop}
          onDelete={setDeletingStop}
          onAddClick={() => setIsAddOpen(true)}
        />
      </div>

      <AddStopModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onCreated={handleCreated} routes={routes} />
      <EditStopModal isOpen={Boolean(editingStop)} onClose={() => setEditingStop(null)} onUpdated={handleUpdated} stop={editingStop} routes={routes} />
      <DeleteStopModal isOpen={Boolean(deletingStop)} onClose={() => setDeletingStop(null)} onDeleted={handleDeleted} stop={deletingStop} />
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      <Footer />
    </div>
  );
}
