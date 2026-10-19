"use client";
import { Button } from "../common/Button";

export function DriverLocationControl({ bus, enabled, gps, retryLocation }) {
  const canRetry = enabled && ["error", "weak", "permission-denied"].includes(gps.state);

  return (
    <section className="mt-3 border-t border-[var(--border)] pt-3" aria-label="Live location controls">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base text-[var(--muted)]" role="status">{!enabled ? "Start your shift to share location." : gps.state === "sharing" ? `Last location update: ${bus.lastLocationUpdate ? new Date(bus.lastLocationUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not received"}` : gps.status}</p>
        {canRetry && <Button type="button" variant="secondary" className="min-h-12" onClick={retryLocation}>{gps.state === "permission-denied" ? "Allow Location" : "Retry GPS"}</Button>}
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">Keep Smart Safar open while driving. Your phone may pause GPS in the background.</p>
      {gps.error && <p role="alert" className="mt-2 break-words text-sm text-[var(--danger)]">{gps.error}</p>}
    </section>
  );
}
