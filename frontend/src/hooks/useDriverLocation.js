"use client";
import { useEffect, useState } from "react";
import { usableDriverFix } from "../lib/transit/driverGps";
import { busService } from "../services/busService";

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

export function useDriverLocation({ bus, enabled, onUpdate, onStatusChange }) {
  const [attempt, setAttempt] = useState(0);
  const [gps, setGps] = useState(() => enabled ? startingState : stoppedState);

  useEffect(() => {
    if (!enabled || !bus?._id) return;

    let active = true;
    const report = (next) => {
      if (!active) return;
      setGps(next);
      onStatusChange(next.state, next.error);
    };

    queueMicrotask(() => {
      if (active) report(startingState);
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
    let signalRevision = 0;
    let lastFix = 0;
    let permissionDenied = false;
    let accessEnded = false;
    const controller = new AbortController();
    const watcher = navigator.geolocation.watchPosition(async ({ coords, timestamp }) => {
      if (!active || permissionDenied || accessEnded) return;
      if (!usableDriverFix({ coords, timestamp })) { signalRevision++; report({ state: "weak", status: "GPS signal weak", error: "Move to an open area and try again." }); return; }
      if (busy || timestamp <= lastFix) return;
      lastFix = timestamp;
      if (!navigator.onLine) { report({ state: "error", status: "Check your internet", error: "" }); return; }
      busy = true;
      const revision = signalRevision;
      setGps((current) => ({ ...current, status: "Sending location..." }));
      try {
        const updated = await busService.updateLocation(bus._id, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp,
          accuracy: coords.accuracy,
          ...(Number.isFinite(coords.speed) && coords.speed >= 0 && coords.speed <= 40 ? { speed: coords.speed * 3.6 } : {}),
        }, { signal: controller.signal });
        if (active && !permissionDenied && navigator.onLine && revision === signalRevision) {
          onUpdate(updated);
          report({ state: "sharing", status: "GPS On", error: "" });
        }
      } catch (requestError) {
        if (active) {
          accessEnded = [401, 403, 404, 409].includes(requestError.response?.status);
          report({
            state: accessEnded ? "access-ended" : "error",
            status: "GPS Weak",
            error: getLocationRequestError(requestError),
          });
        }
      } finally {
        busy = false;
      }
    }, (locationError) => {
      if (!active) return;
      signalRevision++;
      permissionDenied = locationError.code === 1;
      report({
        state: permissionDenied ? "permission-denied" : "error",
        status: permissionDenied ? "Permission Denied" : "GPS Weak",
        error: permissionDenied
          ? "Allow location in your browser settings, then try again."
          : locationError.code === 3
            ? "Finding your location timed out. Try again with a clear GPS signal."
            : "Your device cannot determine its location. Check GPS settings and try again.",
      });
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });

    const recover = () => { if (active && navigator.onLine && !permissionDenied && !accessEnded && document.visibilityState !== "hidden") setAttempt(value => value + 1); };
    const offline = () => { signalRevision++; if (!permissionDenied && !accessEnded) report({ state: "error", status: "Check your internet", error: "" }); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
      active = false;
      controller.abort();
      navigator.geolocation.clearWatch(watcher);
    };
  }, [enabled, attempt, bus?._id, onUpdate, onStatusChange]);

  function retryLocation() {
    setGps(startingState);
    onStatusChange("starting", "");
    setAttempt((value) => value + 1);
  }

  return { gps: enabled ? gps : stoppedState, retryLocation };
}

function getLocationRequestError(error) {
  if (!error.response) return "Unable to send your location. Check your connection and try again.";
  if (error.response.status === 401) return "Your session has expired. Sign in again.";
  if (error.response.status === 403) return "You no longer have permission to update this bus. Refresh your dashboard.";
  if (error.response.status === 404) return "This bus is no longer available. Refresh your dashboard.";
  if (error.response.status === 422) return "An older GPS fix was ignored. Waiting for a fresh location.";
  if (error.response.status === 409) return "An active shift is required to share location.";
  return "Unable to send your location. Please try again.";
}
