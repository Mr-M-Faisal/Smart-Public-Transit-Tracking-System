"use client";

import { useEffect, useState } from "react";
import { Button } from "../common/Button";
import { busService } from "../../services/busService";

const stoppedState = {
  state: "stopped",
  status: "Start your shift to share location",
  error: "",
};

const startingState = {
  state: "starting",
  status: "GPS Starting",
  error: "",
};

export function DriverLocationControl({ bus, enabled, onUpdate, onStatusChange }) {
  const [attempt, setAttempt] = useState(0);
  const [gps, setGps] = useState(() => enabled ? startingState : stoppedState);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const report = (next) => {
      if (!active) return;
      setGps(next);
      onStatusChange(next.state, next.error);
    };

    queueMicrotask(() => {
      if (active) onStatusChange("starting", "");
    });

    if (!window.isSecureContext || !navigator.geolocation) {
      queueMicrotask(() => report({
        state: "error",
        status: "Location unavailable",
        error: "Location is unavailable. Open the secure Smart Safar site in your browser.",
      }));
      return () => { active = false; };
    }

    let busy = false;
    const controller = new AbortController();
    const watcher = navigator.geolocation.watchPosition(async ({ coords }) => {
      if (!active || busy) return;
      busy = true;
      setGps((current) => ({ ...current, status: "Sending location..." }));
      try {
        const updated = await busService.updateLocation(bus._id, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          ...(coords.speed != null && coords.speed >= 0 ? { speed: coords.speed * 3.6 } : {}),
        }, { signal: controller.signal });
        if (active) {
          onUpdate(updated);
          report({ state: "sharing", status: "GPS On", error: "" });
        }
      } catch (requestError) {
        if (active) {
          report({
            state: "error",
            status: "GPS Weak",
            error: getLocationRequestError(requestError),
          });
        }
      } finally {
        busy = false;
      }
    }, (locationError) => {
      if (!active) return;
      const permissionDenied = locationError.code === 1;
      report({
        state: permissionDenied ? "permission-denied" : "error",
        status: "Location unavailable",
        error: permissionDenied
          ? "Allow location in your browser settings, then try again."
          : locationError.code === 3
            ? "Finding your location timed out. Try again with a clear GPS signal."
            : "Your device cannot determine its location. Check GPS settings and try again.",
      });
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });

    return () => {
      active = false;
      controller.abort();
      navigator.geolocation.clearWatch(watcher);
    };
  }, [enabled, attempt, bus._id, onUpdate, onStatusChange]);

  function retryLocation() {
    setGps(startingState);
    onStatusChange("starting", "");
    setAttempt((value) => value + 1);
  }

  const canRetry = enabled && ["error", "permission-denied"].includes(gps.state);

  return (
    <section className="mt-3 border-t border-[var(--border)] pt-3" aria-label="Live location controls">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base text-[var(--muted)]" role="status">{!enabled ? "Start your shift to share location." : gps.state === "sharing" ? `Last location update: ${bus.lastLocationUpdate ? new Date(bus.lastLocationUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not received"}` : gps.status}</p>
        {canRetry && <Button type="button" variant="secondary" className="min-h-12" onClick={retryLocation}>{gps.state === "permission-denied" ? "Allow Location" : "Retry GPS"}</Button>}
      </div>
      {gps.error && <p role="alert" className="mt-2 break-words text-sm text-[var(--danger)]">{gps.error}</p>}
    </section>
  );
}

function getLocationRequestError(error) {
  if (!error.response) return "Unable to send your location. Check your connection and try again.";
  if (error.response.status === 401) return "Your session has expired. Sign in again.";
  if (error.response.status === 403) return "You no longer have permission to update this bus. Refresh your dashboard.";
  if (error.response.status === 404) return "This bus is no longer available. Refresh your dashboard.";
  if (error.response.status === 409) return "An active shift is required to share location.";
  return "Unable to send your location. Please try again.";
}
