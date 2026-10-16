"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../common/Button";
import { stopService } from "../../../services/stopService";

export function DeleteStopModal({ isOpen, onClose, onDeleted, stop }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !stop) return null;

  const stopId = stop._id || stop.id;

  async function handleDelete() {
    setError("");
    setSubmitting(true);
    try {
      await stopService.delete(stopId, {
        route: stop.route?._id || stop.route?.id || stop.route,
        routeStopId: stop.routeStopId,
      });
      onDeleted(stop.routeStopId || `${stopId}:${stop.route?._id || stop.route?.id || stop.route}`);
      onClose();
    } catch (err) {
      console.error("Delete stop error", err);
      setError(err.response?.data?.message || "Failed to delete stop. It may be in use by an active route or bus.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-labelledby="delete-stop-title">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
          <AlertTriangle size={24} />
        </div>
        <h2 id="delete-stop-title" className="mt-4 text-lg font-bold text-[var(--foreground)]">
          Delete Stop?
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Remove <strong className="text-[var(--foreground)]">{stop.stopName}</strong> from this route? The physical stop remains available to other routes.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger)]">{error}</p>
        )}

        <div className="mt-5 flex justify-center gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="bg-[var(--danger)] hover:bg-[#c0392b]"
          >
            {submitting ? "Deleting..." : "Delete Stop"}
          </Button>
        </div>
      </div>
    </div>
  );
}
