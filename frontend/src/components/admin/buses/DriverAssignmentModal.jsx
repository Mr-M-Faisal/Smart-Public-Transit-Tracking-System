"use client";

import { useEffect, useRef, useState } from "react";
import Link from "../../common/SmartLink";
import { AdminDialog } from "../AdminDialog";
import { Button } from "../../common/Button";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { busService } from "../../../services/busService";
import { getAdminError } from "../../../lib/transit/adminErrors";

export function DriverAssignmentModal({ bus, buses, drivers, driverStatus, onRetryDrivers, initialDriverId = "", initialBusId = "", mode = "assign", onClose, onUpdated }) {
  const request = useRef(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const [busId, setBusId] = useState(bus?._id || initialBusId);
  const [driverId, setDriverId] = useState(initialDriverId || bus?.driver?._id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedBus = buses.find((item) => item._id === busId);
  const selectedDriver = drivers.find((item) => item._id === driverId);
  const unassign = mode === "unassign";
  const title = unassign ? "Unassign Driver?" : bus?.driver ? "Change Driver" : "Assign Driver";
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  function close() { if (!inFlight.current) onClose(); }
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    if (!selectedBus || (!unassign && (driverStatus !== "ready" || !selectedDriver))) {
      setError("Select a bus and a driver from the loaded directory."); return;
    }
    inFlight.current = true; setBusy(true);
    request.current = new AbortController();
    try {
      await busService.update(busId, { driver: unassign ? null : driverId }, { signal: request.current.signal });
      if (mounted.current) {
        await onUpdated(unassign ? "Driver unassigned successfully." : "Driver assigned successfully.");
        if (mounted.current) onClose();
      }
    } catch (requestError) {
      if (mounted.current) setError(getAdminError(requestError, "Unable to save the assignment. Check your connection and try again."));
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <AdminDialog id="driver-assignment" title={title} descriptionId="driver-assignment-help" busy={busy} onClose={close}>
    <p id="driver-assignment-help" className="mt-4 text-sm leading-6 text-[var(--muted)]">{unassign ? "Confirm the driver assignment update." : "Select a driver account to assign."}</p>
    <form onSubmit={submit} aria-busy={busy} className="mt-4 grid gap-4">
      {unassign ? <p className="break-words text-sm leading-6">Unassign <strong>{bus?.driver?.name || "the current driver"}</strong> from bus <strong>{bus?.busNumber}</strong>?</p> : <>
        {bus ? <div className="grid gap-2 text-sm"><span className="font-semibold">Bus</span><p className="break-words rounded-xl border border-[var(--border)] bg-[var(--primary-soft)] p-3">{bus.busNumber}{bus.route?.routeName ? " - " + bus.route.routeName : ""}</p></div> : <label htmlFor="assignment-bus" className="grid gap-2 text-sm font-semibold">Bus<select id="assignment-bus" className="field-input min-h-12" required disabled={busy} value={busId} onChange={(event) => setBusId(event.target.value)}><option value="">Select a bus</option>{buses.map((item) => <option key={item._id} value={item._id}>{item.busNumber}{item.route?.routeName ? " - " + item.route.routeName : ""}</option>)}</select></label>}
        {driverStatus === "error" ? <div role="alert" className="grid gap-3 text-sm"><p className="text-[var(--danger)]">Unable to load drivers.</p><Button type="button" variant="secondary" className="min-h-12 justify-self-start" disabled={busy} onClick={onRetryDrivers}>Retry</Button></div> : driverStatus !== "ready" ? <LoadingSpinner label="Loading drivers..." /> : !drivers.length ? <div role="status" className="text-sm leading-6"><p>No drivers have been created yet.</p><Link href="/admin/users" className="font-semibold text-[var(--primary-ink)]">Open Driver Management to create a driver.</Link></div> : <>
          <label htmlFor="assignment-driver" className="grid gap-2 text-sm font-semibold">Driver<select id="assignment-driver" className="field-input min-h-12" required disabled={busy} value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">Select a driver</option>{drivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.name} - {driver.email}{driver.assignedBus ? " (already assigned)" : ""}</option>)}</select></label>
          {selectedDriver && <p className="break-all text-xs leading-5 text-[var(--muted)]">Driver ID: {selectedDriver._id}{selectedDriver.assignedBus ? " | Current bus: " + (buses.find((item) => item._id === selectedDriver.assignedBus)?.busNumber || selectedDriver.assignedBus) : " | No bus assigned"}</p>}
        </>}
      </>}
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border)] pt-4"><Button type="button" variant="secondary" className="min-h-12" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" variant={unassign ? "danger" : "primary"} className="min-h-12" disabled={busy || !selectedBus || (!unassign && (driverStatus !== "ready" || !selectedDriver))}>{busy ? "Saving..." : unassign ? "Unassign Driver" : "Save Assignment"}</Button></div>
    </form>
  </AdminDialog>;
}
