"use client";
import { useSyncExternalStore } from "react";
// One lightweight expiry clock shared by all visible telemetry consumers.
const listeners = new Set();
let now = 0, timer;
function subscribe(listener) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => { now = Date.now(); listeners.forEach(notify => notify()); }, 5000);
  }
  return () => { listeners.delete(listener); if (!listeners.size) { clearInterval(timer); timer = null; } };
}
const snapshot = () => now;
const serverSnapshot = () => 0;
export function useTelemetryNow() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
