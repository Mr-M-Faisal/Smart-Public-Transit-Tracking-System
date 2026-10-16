"use client";

import { useEffect, useState } from "react";
import { Edit3, X } from "lucide-react";
import { Button } from "../../common/Button";
import { routeService } from "../../../services/routeService";

export function EditRouteModal({ isOpen, onClose, onUpdated, route }) {
  const [routeName, setRouteName] = useState("");
  const [startPoint, setStartPoint] = useState("");
  const [endPoint, setEndPoint] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!route) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setRouteName(route.routeName || "");
      setStartPoint(route.startPoint || "");
      setEndPoint(route.endPoint || "");
      setDescription(route.description || "");
      setError("");
    });
    return () => { active = false; };
  }, [route]);

  if (!isOpen || !route) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = routeName.trim();
    const start = startPoint.trim();
    const end = endPoint.trim();

    if (!name) { setError("Route name is required."); return; }
    if (!start) { setError("Starting point is required."); return; }
    if (!end) { setError("Destination is required."); return; }

    setSubmitting(true);
    try {
      const routeId = route._id || route.id;
      const updated = await routeService.update(routeId, {
        routeName: name,
        startPoint: start,
        endPoint: end,
        description: description.trim(),
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error("Failed to update route", err);
      setError(err.response?.data?.message || "Failed to update route. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-route-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
              <Edit3 size={18} />
            </span>
            <div>
              <h2 id="edit-route-modal-title" className="text-lg font-bold text-[var(--foreground)]">
                Edit Route
              </h2>
              <p className="text-xs text-[var(--muted)]">{route.routeName}</p>
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

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-route-name" className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
              Route Name / Number <span aria-hidden="true" className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="edit-route-name"
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="field-input text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-route-start" className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
              Starting Point <span aria-hidden="true" className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="edit-route-start"
              type="text"
              value={startPoint}
              onChange={(e) => setStartPoint(e.target.value)}
              className="field-input text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-route-end" className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
              Destination <span aria-hidden="true" className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="edit-route-end"
              type="text"
              value={endPoint}
              onChange={(e) => setEndPoint(e.target.value)}
              className="field-input text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-route-desc" className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
              Description <span className="text-[var(--muted)] font-normal">(optional)</span>
            </label>
            <textarea
              id="edit-route-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="field-input text-sm min-h-[72px] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
