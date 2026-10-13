"use client";


import Link from "../../common/SmartLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { BusFront, ArrowLeft, CheckCircle2, Clock, Filter, Plus, RefreshCw, Wrench } from "lucide-react";
import { Navbar } from "../../navigation/Navbar";
import { Footer } from "../../navigation/Footer";
import { Button } from "../../common/Button";
import { Card } from "../../common/Card";
import { CardBackdrop } from "../../common/CardBackdrop";
import { CompactPageSearch } from "../CompactPageSearch";
import { ErrorState } from "../../common/ErrorState";
import { ProtectedPage } from "../../common/ProtectedPage";
import { useSocket } from "../../../hooks/useSocket";
import { useDriverDirectory } from "../../../hooks/useDriverDirectory";
import { busService } from "../../../services/busService";
import { routeService } from "../../../services/routeService";
import { BusTable } from "./BusTable";
import { AddBusModal } from "./AddBusModal";
import { EditBusModal } from "./EditBusModal";
import { DeleteBusModal } from "./DeleteBusModal";
import { DriverAssignmentModal } from "./DriverAssignmentModal";

export default function BusManagementPage() {
  return <PageShell><ProtectedPage adminOnly>{() => <BusOperations />}</ProtectedPage></PageShell>;
}

function BusOperations() {
  const socket = useSocket();
  const directory = useDriverDirectory({ autoLoad: false });
  const { refresh: refreshDrivers } = directory;
  const sequence = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [message, setMessage] = useState("");
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [deletingBus, setDeletingBus] = useState(null);
  const [assignment, setAssignment] = useState(null);

  const loadData = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true);
    setError(false);
    const [fleet, routeList] = await Promise.allSettled([busService.list(), routeService.list()]);
    if (id !== sequence.current) return;
    if (fleet.status === "fulfilled") setBuses(fleet.value);
    else setError(true);
    setRouteError(routeList.status === "rejected");
    if (routeList.status === "fulfilled") setRoutes(routeList.value);
    else setRoutes([]);
    setLoading(false);
  }, []);

  useEffect(() => { let active = true; queueMicrotask(() => { if (active) loadData(); }); return () => { active = false; sequence.current += 1; }; }, [loadData]);
  const watchedBusIds = buses.map((bus) => bus._id).join(",");
  useEffect(() => {
    const watch = () => { watchedBusIds.split(",").filter(Boolean).forEach((id) => socket.emit("watchBus", id)); };
    const update = (location) => setBuses((current) => current.map((bus) => bus._id === location.busId ? { ...bus, currentLocation: { latitude: location.latitude, longitude: location.longitude }, lastLocationUpdate: location.lastLocationUpdate, status: location.status } : bus));
    socket.on("connect", watch);
    socket.on("locationUpdate", update);
    if (socket.connected) watch();
    return () => { socket.off("connect", watch); socket.off("locationUpdate", update); };
  }, [socket, watchedBusIds]);

  async function handleSaved(feedback) { setMessage(feedback); await loadData(); }
  async function handleAssignmentSaved(feedback) { setMessage(feedback); await Promise.all([loadData(), refreshDrivers()]); }
  function openAssignment(bus, mode) { setAssignment({ bus, mode }); refreshDrivers(); }
  function handleRefresh() { setMessage(""); loadData(); }
  const filteredBuses = buses.filter((bus) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = [bus.busNumber, bus.route?.routeName, bus.driver?.name].some((value) => String(value || "").toLowerCase().includes(term));
    return matchesSearch && (statusFilter === "all" || bus.status === statusFilter) && (routeFilter === "all" || (bus.route?._id || bus.route) === routeFilter) && (assignmentFilter === "all" || (assignmentFilter === "assigned" ? Boolean(bus.driver) : !bus.driver));
  });
  if (error) return <div className="py-8">{message && <p role="status" className="mb-4 text-sm text-[var(--success)]">{message} The fleet refresh failed; try again to confirm the latest records.</p>}<ErrorState title="Unable to load buses" description="Fleet information could not be confirmed. Check your connection and try again." action={<Button onClick={loadData} disabled={loading} className="min-h-12">{loading ? "Refreshing..." : "Try again"}</Button>} /></div>;
  const totalCount = loading ? "..." : buses.length;
  const activeCount = loading ? "..." : buses.filter((bus) => bus.status === "active").length;
  const idleCount = loading ? "..." : buses.filter((bus) => bus.status === "idle").length;
  const maintCount = loading ? "..." : buses.filter((bus) => bus.status === "maintenance").length;

  return <>
      {/* Back to Dashboard Navigation */}
      <div className="mb-4">
        <Link href="/admin/dashboard" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--primary-ink)] hover:border-[var(--primary)] transition" aria-label="Back to Admin Dashboard" title="Back to Admin Dashboard"><ArrowLeft size={16} /></Link>
      </div>

      {/* Page Header */}
      <header className="premium-dashboard-header premium-card premium-card--primary premium-card--imagery flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
        <CardBackdrop visual="fleet" priority />
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">
              Fleet Operations
            </p>
            <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--primary-ink)]">
              {totalCount} Total
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Bus Management
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Manage and monitor the buses operating in the transit system.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <CompactPageSearch label="Search buses" placeholder="Bus number, route, or driver" value={searchTerm} onChange={setSearchTerm} />
          <Button
            type="button"
            variant="secondary"
            className="min-h-12 gap-2 text-xs"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh bus list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>

          <Button type="button" className="min-h-12 gap-1.5 text-xs" disabled={loading || routeError} onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Add Bus
          </Button>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-3"><Link href="/admin/users" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary-ink)]">Driver Management</Link></div>

      {message && <p role="status" className="mt-4 text-sm text-[var(--success)]">{message}</p>}
      {directory.status === "error" && !assignment && <p role="alert" className="mt-4 text-sm text-[var(--danger)]">The driver directory could not be refreshed. Open the assignment dialog and retry to confirm available drivers.</p>}
      {routeError && <p role="alert" className="mt-4 text-sm text-[var(--danger)]">Routes could not be loaded. Refresh the fleet before adding or editing a bus.</p>}
      {/* Status KPI Summary Strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card treatment="stat" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted)]">Total Fleet</span>
            <BusFront size={16} className="text-[var(--primary-ink)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{totalCount}</p>
        </Card>

        <Card treatment="stat" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--success)]">Active Buses</span>
            <CheckCircle2 size={16} className="text-[var(--success)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{activeCount}</p>
        </Card>

        <Card treatment="stat" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--warning)]">Idle Buses</span>
            <Clock size={16} className="text-[var(--warning)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{idleCount}</p>
        </Card>

        <Card treatment="stat" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--danger)]">Maintenance</span>
            <Wrench size={16} className="text-[var(--danger)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{maintCount}</p>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="premium-card premium-card--operational mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <select aria-label="Filter fleet assignment" value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)} className="min-h-11 max-w-full rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold"><option value="all">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select>
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-[var(--muted)]" />
            <select
              aria-label="Filter bus status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="idle">Idle Only</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {/* Route Filter */}
          <select
            aria-label="Filter bus route"
            disabled={routeError}
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--primary)] max-w-[180px] truncate"
          >
            <option value="all">All Routes</option>
            {routes.map((r) => (
              <option key={r._id || r.id} value={r._id || r.id}>
                {r.routeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bus List Table / Mobile Cards */}
      <div className="mt-6">
        <BusTable
          buses={filteredBuses}
          loading={loading}
          onEdit={(bus) => setEditingBus(bus)}
          onDelete={(bus) => setDeletingBus(bus)}
          editDisabled={routeError}
          onAssign={(bus) => openAssignment(bus, "assign")}
          onUnassign={(bus) => openAssignment(bus, "unassign")}
          onAddClick={routeError ? undefined : () => setIsAddOpen(true)}
        />
      </div>

      {/* Mount each form for its selected record so backend refreshes cannot reset a draft. */}
      {isAddOpen && <AddBusModal isOpen onClose={() => setIsAddOpen(false)} onCreated={() => handleSaved("Bus created.")} routes={routes} />}
      {editingBus && <EditBusModal key={editingBus._id} isOpen onClose={() => setEditingBus(null)} onUpdated={() => handleSaved("Bus updated.")} bus={editingBus} routes={routes} />}
      {deletingBus && <DeleteBusModal key={deletingBus._id} isOpen onClose={() => setDeletingBus(null)} onDeleted={() => handleSaved("Bus deleted.")} bus={deletingBus} />}
      {assignment && <DriverAssignmentModal key={assignment.bus._id + assignment.mode} bus={assignment.bus} buses={buses} mode={assignment.mode} drivers={directory.drivers} driverStatus={directory.status} onRetryDrivers={refreshDrivers} onClose={() => setAssignment(null)} onUpdated={handleAssignmentSaved} />}
  </>;
}

function PageShell({ children }) {
  return <div className="min-h-screen bg-[var(--background)]"><Navbar /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main><Footer /></div>;
}
