"use client";


import { useEffect, useRef, useState } from "react";
import { BusFront, X } from "lucide-react";
import { Button } from "../../common/Button";
import { busService } from "../../../services/busService";

export function AddBusModal({ isOpen, onClose, onCreated, routes = [] }) {
  const [busNumber, setBusNumber] = useState("");
  const [routeId, setRouteId] = useState(routes[0]?._id || "");
  const [capacity, setCapacity] = useState("");
  const [gentsSeats, setGentsSeats] = useState("");
  const [ladiesSeats, setLadiesSeats] = useState("");
  const [seatLayout, setSeatLayout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);


  if (!isOpen) return null;

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
      setError("Please select an operating route.");
      return;
    }
    const capNum = Number(capacity);
    if (!Number.isInteger(capNum) || capNum <= 0 || capNum > 100) {
      setError("Capacity must be an integer from 1 to 100.");
      return;
    }
    const usesSections = gentsSeats !== "" || ladiesSeats !== "";
    const gentsNum = Number(gentsSeats);
    const ladiesNum = Number(ladiesSeats);
    if (usesSections && (!Number.isInteger(gentsNum) || !Number.isInteger(ladiesNum) || gentsNum < 0 || ladiesNum < 0 || gentsNum + ladiesNum !== capNum)) {
      setError("Gents and ladies seat counts must be whole numbers that add up to capacity.");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const newBus = await busService.create({
        busNumber: trimmedBusNumber,
        route: routeId,
        capacity: capNum,
        ...(usesSections ? { gentsSeats: gentsNum, ladiesSeats: ladiesNum } : {}),
        ...(seatLayout.trim() ? { seatLayout: seatLayout.trim() } : {}),
      });
      if (mounted.current) { await onCreated(newBus); if (mounted.current) onClose(); }
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
      aria-labelledby="add-bus-modal-title"
    >
      <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
              <BusFront size={18} />
            </span>
            <div>
              <h2 id="add-bus-modal-title" className="text-lg font-bold text-[var(--foreground)]">
                Add Transit Bus
              </h2>
              <p className="text-xs text-[var(--muted)]">Register a new fleet vehicle</p>
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
            <label htmlFor="busNumber" className="block text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
              Bus Registration Number *
            </label>
            <input
              id="busNumber"
              type="text"
              required
              disabled={submitting}
              placeholder="e.g. FSD-101 or BUS-42"
              value={busNumber}
              onChange={(e) => setBusNumber(e.target.value)}
              className="field-input text-sm"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="gents-seats" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">Gents seats</label><input id="gents-seats" type="number" min="0" max="100" value={gentsSeats} onChange={(event) => setGentsSeats(event.target.value)} disabled={submitting} className="field-input text-sm" /></div>
            <div><label htmlFor="ladies-seats" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">Ladies seats</label><input id="ladies-seats" type="number" min="0" max="100" value={ladiesSeats} onChange={(event) => setLadiesSeats(event.target.value)} disabled={submitting} className="field-input text-sm" /></div>
          </div>
          <p className="-mt-2 text-xs leading-5 text-[var(--muted)]">Optional. Enter both counts to create a sectioned bus. If no custom layout is provided, we create G01… seats at the front and W01… seats toward the back.</p>

          <div>
            <label htmlFor="route" className="block text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
              Assigned Route *
            </label>
            <select
              id="route"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="field-input text-sm"
              required
              disabled={submitting}
            >
              <option value="" disabled>Select transit corridor</option>
              {routes.map((r) => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {r.routeName} ({r.startPoint} to {r.endPoint})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="capacity" className="block text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-1.5">
              Seating Capacity *
            </label>
            <input
              id="capacity"
              type="number"
              min="1"
              max="100"
              required
              disabled={submitting}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="field-input text-sm"
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Initial available seats will match capacity. Initial status will be set to idle.
            </p>
          </div>

          <div>
            <label htmlFor="seat-layout" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">Physical seat layout (optional)</label>
            <textarea id="seat-layout" rows={4} value={seatLayout} onChange={(event) => setSeatLayout(event.target.value)} disabled={submitting} className="field-input font-mono text-sm" placeholder={'G01,G02,_,G03,G04\nW01,W02,_,W03,W04'} />
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">One row per line; comma-separated labels, _ for an aisle. Unique seat count must equal capacity. For sectioned buses, use G01… and W01… labels that match the counts above.</p>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="secondary" className="min-h-12" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-12" disabled={submitting}>
              {submitting ? "Registering..." : "Add Bus"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
