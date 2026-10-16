"use client";

import { useEffect, useRef, useState } from "react";
import { Edit3, X } from "lucide-react";
import { Button } from "../../common/Button";
import { AdminDialog } from "../AdminDialog";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { busService } from "../../../services/busService";

function layoutFromMap(seatMap = []) {
  if (!seatMap.length) return "";
  const rows = [];
  seatMap.forEach((seat) => {
    rows[seat.row] ||= [];
    rows[seat.row][seat.column] = seat.label;
  });
  return rows.map((row) => Array.from({ length: row.length }, (_, index) => row[index] || "_").join(",")).join("\n");
}
const VALID_STATUSES = ["active", "idle", "maintenance"];

export function EditBusModal(props) {
  const busId = props.bus?._id;
  const [detail, setDetail] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!props.isOpen || !busId) return undefined;
    let active = true;
    busService.get(busId).then((data) => {
      if (active) { setDetail(data); setFailed(false); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [busId, props.isOpen, retry]);
  if (!props.isOpen || !busId) return null;
  if (detail?._id === busId) return <EditBusForm {...props} bus={detail} />;
  return <AdminDialog id="edit-bus-loading" title="Edit bus" onClose={props.onClose}>
    {failed ? <div role="alert" className="mt-4"><p>Unable to load the bus seat layout.</p><Button onClick={() => { setFailed(false); setRetry((value) => value + 1); }}>Retry</Button></div> : <LoadingSpinner label="Loading bus details..." />}
  </AdminDialog>;
}

function EditBusForm({ isOpen, onClose, onUpdated, bus, routes = [] }) {
  const [busNumber, setBusNumber] = useState(bus?.busNumber || "");
  const [routeId, setRouteId] = useState(bus?.route?._id || bus?.route || "");
  const [capacity, setCapacity] = useState(bus?.capacity ?? "");
  const [availableSeats, setAvailableSeats] = useState(bus?.availableSeats ?? "");
  const [seatLayout, setSeatLayout] = useState(layoutFromMap(bus?.seatMap));
  const [gentsSeats, setGentsSeats] = useState(bus?.seatSections?.gents || "");
  const [ladiesSeats, setLadiesSeats] = useState(bus?.seatSections?.ladies || "");
  const [status, setStatus] = useState(bus?.status || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);


  if (!isOpen || !bus) return null;
  const hasSeatLayout = Boolean(bus.seatMap?.length || seatLayout.trim());
  const layoutChanged = seatLayout.trim() !== layoutFromMap(bus.seatMap);
  const shownAvailableSeats = hasSeatLayout
    ? (layoutChanged ? capacity : bus.seatMap.filter((seat) => seat.status === "available").length)
    : availableSeats;

  async function handleSubmit(e) {
    e.preventDefault();
    if (inFlight.current) return;
    setError("");

    const trimmedBusNumber = busNumber.trim();
    if (!trimmedBusNumber) {
      setError("Bus number is required.");
      return;
    }
    if (!routeId) {
      setError("Please select a route.");
      return;
    }
    const capNum = Number(capacity);
    const seatsNum = Number(availableSeats);
    if (!Number.isInteger(capNum) || capNum <= 0 || capNum > 100) {
      setError("Capacity must be an integer from 1 to 100.");
      return;
    }
    const usesSections = gentsSeats !== "" || ladiesSeats !== "";
    const gentsNum = Number(gentsSeats);
    const ladiesNum = Number(ladiesSeats);
    const sectionsChanged = usesSections && (gentsNum !== Number(bus.seatSections?.gents || 0) || ladiesNum !== Number(bus.seatSections?.ladies || 0));
    if (usesSections && (!Number.isInteger(gentsNum) || !Number.isInteger(ladiesNum) || gentsNum < 0 || ladiesNum < 0 || gentsNum + ladiesNum !== capNum)) {
      setError("Gents and ladies seat counts must be whole numbers that add up to capacity.");
      return;
    }
    if (!hasSeatLayout && (!Number.isInteger(seatsNum) || seatsNum < 0)) {
      setError("Available seats cannot be negative.");
      return;
    }
    if (!hasSeatLayout && seatsNum > capNum) {
      setError(`Available seats (${seatsNum}) cannot exceed total capacity (${capNum}).`);
      return;
    }
    if (bus.seatMap?.length && !seatLayout.trim()) {
      setError("A configured bus must keep its physical seat layout.");
      return;
    }
    if (!VALID_STATUSES.includes(status)) {
      setError("Invalid status selected.");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const busId = bus._id || bus.id;
      const updatedBus = await busService.update(busId, {
        busNumber: trimmedBusNumber,
        route: routeId,
        capacity: capNum,
        ...(sectionsChanged ? { gentsSeats: gentsNum, ladiesSeats: ladiesNum } : {}),
        ...(!hasSeatLayout ? { availableSeats: seatsNum } : {}),
        ...(seatLayout.trim() && seatLayout.trim() !== layoutFromMap(bus.seatMap) ? { seatLayout: seatLayout.trim() } : {}),
        status,
      });
      if (mounted.current) { await onUpdated(updatedBus); if (mounted.current) onClose(); }
    } catch (err) {
      if (mounted.current) {
        const status = err.response?.status;
        const duplicate = String(err.response?.data?.error || "").includes("E11000");
        setError(status === 403 ? "Administrator permission is required to manage buses." : status === 404 ? "This bus is no longer available. Refresh the fleet." : duplicate ? "This bus number is already registered. Choose a different number." : err.response?.data?.message || "Unable to save the bus. Check your connection and try again.");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-bus-modal-title"
    >
      <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
              <Edit3 size={18} />
            </span>
            <div>
              <h2 id="edit-bus-modal-title" className="text-lg font-bold text-[var(--foreground)]">
                Edit Transit Bus
              </h2>
              <p className="text-xs text-[var(--muted)]">Update operational details for {bus.busNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--foreground)]"
            disabled={submitting}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#f4cccc] bg-[var(--danger-soft)] p-3 text-xs text-[var(--danger)]" role="alert">
            {error}
          </div>
        )}

        <form aria-busy={submitting} onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-busNumber" className="block text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
              Bus Number *
            </label>
            <input
              id="edit-busNumber"
              type="text"
              required
              disabled={submitting}
              value={busNumber}
              onChange={(e) => setBusNumber(e.target.value)}
              className="field-input text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-route" className="block text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
              Assigned Route *
            </label>
            <select
              id="edit-route"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="field-input text-sm"
              required
              disabled={submitting}
            >
              <option value="" disabled>Select route</option>
              {routes.map((r) => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {r.routeName} ({r.startPoint} to {r.endPoint})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-capacity" className="block text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
                Capacity *
              </label>
              <input
                id="edit-capacity"
                type="number"
                min="1"
                max="100"
                required
                disabled={submitting}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="field-input text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-availableSeats" className="block text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
                Available Seats {hasSeatLayout ? "(derived)" : "*"}
              </label>
              <input
                id="edit-availableSeats"
                type="number"
                min="0"
                max={hasSeatLayout ? undefined : capacity}
                required
                disabled={submitting}
                value={shownAvailableSeats}
                readOnly={hasSeatLayout}
                aria-describedby={hasSeatLayout ? "edit-seat-count-note" : undefined}
                onChange={(e) => setAvailableSeats(e.target.value)}
                className="field-input text-sm"
              />
            </div>
          </div>

          {hasSeatLayout && <p id="edit-seat-count-note" className="text-xs leading-5 text-[var(--muted)]">Availability comes from individual seats. A replacement layout starts with all seats available and requires no occupied seats or active bookings.</p>}
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="edit-gents-seats" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">Gents seats</label><input id="edit-gents-seats" type="number" min="0" max="100" value={gentsSeats} onChange={(event) => setGentsSeats(event.target.value)} disabled={submitting} className="field-input text-sm" /></div>
            <div><label htmlFor="edit-ladies-seats" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">Ladies seats</label><input id="edit-ladies-seats" type="number" min="0" max="100" value={ladiesSeats} onChange={(event) => setLadiesSeats(event.target.value)} disabled={submitting} className="field-input text-sm" /></div>
          </div>
          <p className="-mt-2 text-xs leading-5 text-[var(--muted)]">Configure both counts for a sectioned Gents/Ladies map. Changing sections replaces the layout only when every seat is free.</p>
          <div>
            <label htmlFor="edit-seat-layout" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">Physical seat layout</label>
            <textarea id="edit-seat-layout" rows={4} value={seatLayout} onChange={(event) => setSeatLayout(event.target.value)} disabled={submitting} className="field-input font-mono text-sm" placeholder={'G01,G02,_,G03,G04\nW01,W02,_,W03,W04'} />
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Rows use comma-separated labels and _ for aisles. Seat count must equal capacity. Sectioned layouts use G01… and W01… labels matching the configured counts.</p>
          </div>
          <div>
            <label htmlFor="edit-status" className="block text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
              Operational Status *
            </label>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="field-input text-sm capitalize"
              required
              disabled={submitting}
            >
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="secondary" className="min-h-12" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-12" disabled={submitting}>
              {submitting ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
