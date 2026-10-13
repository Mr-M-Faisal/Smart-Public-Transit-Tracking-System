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
  Route as RouteIcon,
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
import { routeService } from "../../../services/routeService";
import { busService } from "../../../services/busService";
import { clearAccessToken } from "../../../lib/auth/token";
import { RouteTable } from "./RouteTable";
import { AddRouteModal } from "./AddRouteModal";
import { EditRouteModal } from "./EditRouteModal";
import { DeleteRouteModal } from "./DeleteRouteModal";
import { RoutePreviewModal } from "./RoutePreviewModal";

export default function RouteManagementPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [deletingRoute, setDeletingRoute] = useState(null);
  const [previewRoute, setPreviewRoute] = useState(null);

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

      const [routesRes, busesRes] = await Promise.allSettled([
        routeService.list(),
        busService.list(),
      ]);

      if (routesRes.status === "fulfilled") {
        const d = routesRes.value;
        setRoutes(Array.isArray(d) ? d : d?.routes || []);
      }
      if (busesRes.status === "fulfilled") {
        setBuses(Array.isArray(busesRes.value) ? busesRes.value : []);
      }
    } catch (err) {
      console.error("Route management load error", err);
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

  const filteredRoutes = useMemo(() => {
    if (!searchTerm.trim()) return routes;
    const q = searchTerm.toLowerCase();
    return routes.filter((r) =>
      [r.routeName, r.startPoint, r.endPoint, r.description]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    );
  }, [routes, searchTerm]);

  // Count buses assigned to each route for display
  const busesPerRoute = useMemo(() => {
    const map = {};
    buses.forEach((bus) => {
      const rId = bus.route?._id || bus.route?.id || bus.route;
      if (rId) {
        map[rId] = (map[rId] || 0) + 1;
      }
    });
    return map;
  }, [buses]);

  function handleCreated(newRoute) {
    setRoutes((prev) => [newRoute, ...prev]);
  }

  function handleUpdated(updatedRoute) {
    setRoutes((prev) =>
      prev.map((r) => ((r._id || r.id) === (updatedRoute._id || updatedRoute.id) ? updatedRoute : r))
    );
  }

  function handleDeleted(deletedId) {
    setRoutes((prev) => prev.filter((r) => (r._id || r.id) !== deletedId));
  }

  function handleRefresh() {
    setRefreshing(true);
    loadData();
  }

  if (authLoading || (loading && !profile && !error)) {
    return (
      <PageShell>
        <PageSkeleton title="Route management" variant="rows" />
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
            You must be signed in as an administrator to manage routes.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link
              href="/login?redirect=/admin/routes"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]"
            >
              Sign In as Admin
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"
            >
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
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fde8e8] text-[var(--danger)]">
            <AlertTriangle size={26} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[var(--foreground)]">Admin Access Required</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            You are signed in as <strong>{profile?.name || "User"}</strong>, but administrator privileges are needed.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link
              href="/routes"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]"
            >
              View Public Routes
            </Link>
            <button
              type="button"
              onClick={() => { clearAccessToken(); router.replace("/login?redirect=/admin/routes"); }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-semibold text-[var(--danger)] hover:bg-[#fff2f2]"
            >
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
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fde8e8] text-[var(--danger)]">
            <AlertTriangle size={26} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[var(--foreground)]">Unable to Load Routes</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            A network or server error occurred. Please try again.
          </p>
          <div className="mt-6">
            <Button type="button" onClick={loadData} className="gap-2">
              <RefreshCw size={15} /> Try Again
            </Button>
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

      {/* Page Header */}
      <header className="premium-dashboard-header premium-card premium-card--primary premium-card--imagery flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
        <CardBackdrop visual="routes" priority />
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">
              Transit Network
            </p>
            <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--primary-ink)]">
              {routes.length} Routes
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Route Management
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Manage transit routes, stops, and route information.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <CompactPageSearch label="Search routes" placeholder="Route, origin, or destination" value={searchTerm} onChange={setSearchTerm} />
          <Button
            type="button"
            variant="secondary"
            className="gap-2 text-xs"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh routes"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button type="button" className="gap-1.5 text-xs" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Add Route
          </Button>
        </div>
      </header>
      {/* Route count summary */}
      {!loading && (
        <div className="mt-4 flex items-center gap-4 text-sm text-[var(--muted)]">
          <span>
            Showing <strong className="text-[var(--foreground)]">{filteredRoutes.length}</strong> of {routes.length} routes
          </span>
          {searchTerm && filteredRoutes.length !== routes.length && (
            <button type="button" onClick={() => setSearchTerm("")} className="text-[var(--primary-ink)] hover:underline">
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Route Table / Cards */}
      <div className="mt-4">
        <RouteTable
          routes={filteredRoutes}
          loading={loading}
          busesPerRoute={busesPerRoute}
          onEdit={setEditingRoute}
          onDelete={setDeletingRoute}
          onPreview={setPreviewRoute}
          onAddClick={() => setIsAddOpen(true)}
        />
      </div>

      {/* Modals */}
      <AddRouteModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={handleCreated}
      />

      <EditRouteModal
        isOpen={Boolean(editingRoute)}
        onClose={() => setEditingRoute(null)}
        onUpdated={handleUpdated}
        route={editingRoute}
      />

      <DeleteRouteModal
        isOpen={Boolean(deletingRoute)}
        onClose={() => setDeletingRoute(null)}
        onDeleted={handleDeleted}
        route={deletingRoute}
        busCount={busesPerRoute[(deletingRoute?._id || deletingRoute?.id)] || 0}
      />

      {previewRoute && (
        <RoutePreviewModal
          route={previewRoute}
          onClose={() => setPreviewRoute(null)}
        />
      )}
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
