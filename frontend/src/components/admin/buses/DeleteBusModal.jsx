"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "../../common/Button";
import { busService } from "../../../services/busService";

export function DeleteBusModal({ isOpen, onClose, onDeleted, bus }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  if (!isOpen || !bus) return null;

  async function handleDelete() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setDeleting(true);
    try {
      const busId = bus._id || bus.id;
      await busService.delete(busId);
      if (mounted.current) { await onDeleted(busId); if (mounted.current) onClose(); }
    } catch (err) {
      if (mounted.current) setError(err.response?.status === 403 ? "Administrator permission is required to delete buses." : "Unable to delete the bus. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-bus-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
              <Trash2 size={18} />
            </span>
            <div>
              <h2 id="delete-bus-modal-title" className="text-lg font-bold text-[var(--foreground)]">
                Delete Bus
              </h2>
              <p className="text-xs text-[var(--muted)]">Permanent fleet deletion</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--foreground)]"
            disabled={deleting}
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

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#ffe082] bg-[var(--warning-soft)] p-4 text-xs text-[var(--warning)]">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[var(--warning)]" />
          <div>
            <p className="font-bold">Are you sure you want to delete bus {bus.busNumber}?</p>
            <p className="mt-1">
              This permanently removes the bus record. Linked booking, report and driver profile records are not cleaned up automatically.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--danger)] px-5 text-sm font-semibold text-white transition hover:bg-[#b03b3b] disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Bus"}
          </button>
        </div>
      </div>
    </div>
  );
}
