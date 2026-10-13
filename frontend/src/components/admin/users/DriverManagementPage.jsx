"use client";

import Link from "../../common/SmartLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Navbar } from "../../navigation/Navbar";
import { Footer } from "../../navigation/Footer";
import { ProtectedPage } from "../../common/ProtectedPage";
import { Button } from "../../common/Button";
import { Card } from "../../common/Card";
import { CompactPageSearch } from "../CompactPageSearch";
import { Badge } from "../../common/Badge";
import { EmptyState } from "../../common/EmptyState";
import { ErrorState } from "../../common/ErrorState";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { DriverAssignmentModal } from "../buses/DriverAssignmentModal";
import { DriverFormModal } from "./DriverFormModal";
import { DriverDeleteModal } from "./DriverDeleteModal";
import { busService } from "../../../services/busService";
import { useDriverDirectory } from "../../../hooks/useDriverDirectory";

export default function DriverManagementPage() {
  return <div className="min-h-screen bg-[var(--background)]"><Navbar /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><ProtectedPage adminOnly>{() => <DriverOperations />}</ProtectedPage></main><Footer /></div>;
}

function DriverOperations() {
  const directory = useDriverDirectory();
  const { refresh: refreshDrivers } = directory;
  const sequence = useRef(0);
  const [buses, setBuses] = useState([]);
  const [busLoading, setBusLoading] = useState(true);
  const [busError, setBusError] = useState(false);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [message, setMessage] = useState("");
  const loadBuses = useCallback(async () => {
    const id = ++sequence.current;
    setBusLoading(true); setBusError(false);
    try { const result = await busService.list(); if (id === sequence.current) setBuses(result); }
    catch { if (id === sequence.current) setBusError(true); }
    finally { if (id === sequence.current) setBusLoading(false); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) loadBuses(); }); return () => { active = false; sequence.current += 1; }; }, [loadBuses]);
  async function refresh() { await Promise.all([refreshDrivers(), loadBuses()]); }
  async function updated(feedback) { setMessage(feedback); await refresh(); }
  const loading = directory.status === "idle" || directory.status === "loading";
  const filtered = directory.drivers.filter((driver) => [driver.name, driver.email, driver.phone, buses.find((bus) => bus._id === driver.assignedBus)?.busNumber].some((value) => String(value || "").toLowerCase().includes(search.trim().toLowerCase())));
  function openAssignment(driver, mode = "assign") {
    const bus = mode === "unassign" ? buses.find((item) => item._id === driver.assignedBus) : undefined;
    setAssignment({ driver, bus, mode });
    refreshDrivers();
  }
  const assignedBus = (driver) => driver.assignedBus ? <Link href={"/buses/" + driver.assignedBus} className="break-all font-semibold text-[var(--primary-ink)]">{buses.find((bus) => bus._id === driver.assignedBus)?.busNumber || driver.assignedBus}</Link> : <span className="text-[var(--muted)]">Unassigned</span>;
  const actions = (driver) => <div className="flex flex-wrap gap-2">
    <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs" aria-label={"Edit driver " + driver.email} onClick={() => setEditor({ driver })}>Edit</Button>
    <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs" aria-label={"Assign bus to " + driver.email} disabled={busLoading || busError || !buses.length} onClick={() => openAssignment(driver)}>Assign Bus</Button>
    {driver.assignedBus && <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs" aria-label={"Unassign bus from " + driver.email} disabled={busLoading || busError || !buses.some((bus) => bus._id === driver.assignedBus)} onClick={() => openAssignment(driver, "unassign")}>Unassign</Button>}
    <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs text-[var(--danger)]" aria-label={"Delete driver " + driver.email} onClick={() => setDeleting(driver)}>Delete</Button>
  </div>;
  return <>
    <Link href="/admin/dashboard" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--primary-ink)] hover:border-[var(--primary)]" aria-label="Back to Admin Dashboard" title="Back to Admin Dashboard"><ArrowLeft size={16} /></Link>
    <header className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Fleet operations</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Driver Management</h1><p className="mt-2 text-sm text-[var(--muted)]">Manage driver accounts and their bus assignments.</p></div><div className="flex flex-wrap gap-3"><CompactPageSearch label="Search drivers" placeholder="Name, email, phone, or bus" value={search} onChange={setSearch} /><Button type="button" variant="secondary" className="min-h-12 gap-2" onClick={refresh} disabled={loading || busLoading}><RefreshCw size={16} aria-hidden="true" />{loading || busLoading ? "Refreshing..." : "Refresh drivers"}</Button><Button type="button" className="min-h-12" onClick={() => setEditor({ driver: null })}>Add Driver</Button></div></header>
    <div className="mt-4 flex flex-wrap gap-3"><Link href="/admin/buses" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary-ink)]">Manage buses</Link><p className="self-center text-sm text-[var(--muted)]">Drivers sign in using their email and password.</p></div>
    {message && <p role="status" className="mt-4 text-sm text-[var(--success)]">{message}</p>}
    {busError && <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--danger)]"><p>Bus details could not be loaded. Saved assignments are shown by bus ID.</p><Button type="button" variant="secondary" className="min-h-11" onClick={loadBuses} disabled={busLoading}>Retry bus details</Button></div>}
    
    <div className="mt-5">{loading ? <LoadingSpinner label="Loading drivers..." /> : directory.status === "error" ? <ErrorState title="Unable to load drivers" description="Check your connection and retry. The driver list could not be confirmed." action={<Button onClick={refreshDrivers} className="min-h-12">Retry</Button>} /> : !filtered.length ? <EmptyState title={search ? "No matching drivers" : "No drivers have been created yet."} description={search ? "Try another name, email or bus number." : "Add a driver account to begin assigning buses."} /> : <>
      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-white xl:block"><table className="w-full table-fixed text-left text-sm"><thead className="bg-[var(--primary-soft)] text-[var(--muted)]"><tr><th scope="col" className="p-4">Driver</th><th scope="col" className="p-4">Email</th><th scope="col" className="w-36 p-4">Phone</th><th scope="col" className="w-40 p-4">Assigned Bus</th><th scope="col" className="w-20 p-4">Role</th><th scope="col" className="w-64 p-4">Actions</th></tr></thead><tbody>{filtered.map((driver) => <tr key={driver._id} data-driver-id={driver._id} className="border-t border-[var(--border)] align-top"><td className="break-words p-4 font-semibold">{driver.name}</td><td className="break-all p-4">{driver.email}</td><td className="break-words p-4">{driver.phone || "Not provided"}</td><td className="p-4">{assignedBus(driver)}</td><td className="p-4"><Badge>{driver.role}</Badge></td><td className="p-4">{actions(driver)}</td></tr>)}</tbody></table></div>
      <div className="grid gap-3 md:grid-cols-2 xl:hidden">{filtered.map((driver) => <Card key={driver._id} data-driver-id={driver._id} className="min-w-0 p-5"><div className="flex flex-wrap justify-between gap-3"><h3 className="break-words font-bold">{driver.name}</h3><Badge>{driver.role}</Badge></div><p className="mt-2 break-all text-sm">{driver.email}</p><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-[var(--muted)]">Phone</dt><dd className="mt-1 break-words">{driver.phone || "Not provided"}</dd></div><div><dt className="text-[var(--muted)]">Assigned Bus</dt><dd className="mt-1">{assignedBus(driver)}</dd></div></dl><div className="mt-4 border-t border-[var(--border)] pt-4">{actions(driver)}</div></Card>)}</div>
    </>}</div>
    {editor && <DriverFormModal key={editor.driver?._id || "create"} driver={editor.driver} onClose={() => setEditor(null)} onSaved={updated} />}
    {deleting && <DriverDeleteModal key={deleting._id} driver={deleting} onClose={() => setDeleting(null)} onDeleted={updated} />}
    {assignment && <DriverAssignmentModal buses={buses} bus={assignment.bus} initialBusId={assignment.driver.assignedBus || ""} initialDriverId={assignment.driver._id} mode={assignment.mode} drivers={directory.drivers} driverStatus={directory.status} onRetryDrivers={refreshDrivers} onClose={() => setAssignment(null)} onUpdated={updated} />}
  </>;
}
