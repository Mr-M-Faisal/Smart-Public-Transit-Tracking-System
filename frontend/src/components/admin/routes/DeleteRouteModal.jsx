"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "../../common/Button";
import { routeService } from "../../../services/routeService";

export function DeleteRouteModal({ isOpen, onClose, onDeleted, route, busCount = 0 }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !route) return null;

  async function handleDelete() {
    setError("");
    setDeleting(true);
    try {
      const routeId = route._id || route.id;
      await routeService.delete(routeId);
      onDeleted(routeId);
      onClose();
    } catch (err) {
      console.error("Failed to delete route", err);
      setError(err.response?.data?.message || "Unable to delete route. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-route-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
              <Trash2 size={18} />
            </span>
            <div>
              <h2 id="delete-route-modal-title" className="text-lg font-bold text-[var(--foreground)]">
                Deactivate Route
              </h2>
              <p className="text-xs text-[var(--muted)]">This is a soft-delete — route is hidden, not erased</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--foreground)]"
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
            <p className="font-bold">Deactivate &ldquo;{route.routeName}&rdquo;?</p>
            <p className="mt-1">
              This route will be hidden from public listings.
              {busCount > 0 && (
                <span className="block mt-1 font-semibold">
                  ⚠ {busCount} bus{busCount !== 1 ? "es are" : " is"} currently assigned to this route and will remain assigned.
                </span>
              )}
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
            {deleting ? "Deactivating..." : "Deactivate Route"}
          </button>
        </div>
      </div>
    </div>
  );
}
