"use client";

import { useEffect, useRef, useState } from "react";
import { AdminDialog } from "../AdminDialog";
import { Button } from "../../common/Button";
import { getStopPosition, isValidPosition } from "../../../lib/transit/coordinates";
import { getAdminError } from "../../../lib/transit/adminErrors";
import { stopService } from "../../../services/stopService";
import dynamic from "next/dynamic";
import { SectionSkeleton } from "../../common/SectionSkeleton";
const StopLocationPicker = dynamic(() => import("./StopLocationPicker").then((module) => module.StopLocationPicker), { ssr: false, loading: () => <SectionSkeleton variant="map" label="Loading stop location map" /> });

export function AddStopModal({ isOpen, ...props }) {
  return isOpen ? <AddStopForm {...props} /> : null;
}

function AddStopForm({ onClose, onCreated, routes }) {
  const [form, setForm] = useState({ route: "", stopName: "", stopOrder: "", latitude: null, longitude: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const position = getStopPosition(form);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function close() { if (!inFlight.current) onClose(); }
  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function selectPosition(next) {
    if (inFlight.current) return;
    if (!isValidPosition(next)) { setError("The selected coordinates are invalid. Choose another location on the map."); return; }
    setForm((current) => ({ ...current, latitude: next[0], longitude: next[1] }));
    setError("");
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    if (!form.stopName.trim()) { setError("Stop name is required."); return; }
    if (!routes.some((route) => route._id === form.route)) { setError("Select a route for this stop."); return; }
    const order = Number(form.stopOrder);
    if (!Number.isInteger(order) || order < 1) { setError("Enter a valid stop order of 1 or greater."); return; }
    if (!position) { setError("Please select the stop location on the map."); return; }
    const payload = { route: form.route, stopName: form.stopName.trim(), stopOrder: order, latitude: position[0], longitude: position[1] };
    inFlight.current = true;
    setSubmitting(true);
    try {
      const saved = await stopService.create(payload);
      if (!mounted.current) return;
      await onCreated(saved);
      if (mounted.current) onClose();
    } catch (requestError) {
      if (mounted.current) setError(getAdminError(requestError, "Unable to save the stop. Check your connection and try again."));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return <AdminDialog id="add-stop" title="Add Stop" busy={submitting} onClose={close} className="max-w-2xl">
    <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="mt-4 space-y-4">
      <div>
        <label htmlFor="add-stop-route" className="mb-1 block text-xs font-semibold">Route</label>
        <select id="add-stop-route" value={form.route} onChange={(event) => updateField("route", event.target.value)} disabled={submitting} className="field-input text-sm" required>
          <option value="">Select a route...</option>
          {routes.map((route) => <option key={route._id} value={route._id}>{route.routeName}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="add-stop-name" className="mb-1 block text-xs font-semibold">Stop Name</label>
        <input id="add-stop-name" type="text" value={form.stopName} onChange={(event) => updateField("stopName", event.target.value)} disabled={submitting} className="field-input text-sm" required />
      </div>
      <div>
        <label htmlFor="add-stop-order" className="mb-1 block text-xs font-semibold">Stop Order</label>
        <input id="add-stop-order" type="number" min="1" step="1" value={form.stopOrder} onChange={(event) => updateField("stopOrder", event.target.value)} disabled={submitting} className="field-input text-sm" required />
      </div>
      <StopLocationPicker idPrefix="add-stop" position={position} onChange={selectPosition} disabled={submitting} />
      {error && <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={close} disabled={submitting} className="min-h-12">Cancel</Button>
        <Button type="submit" disabled={submitting} className="min-h-12">{submitting ? "Saving..." : "Save Stop"}</Button>
      </div>
    </form>
  </AdminDialog>;
}
