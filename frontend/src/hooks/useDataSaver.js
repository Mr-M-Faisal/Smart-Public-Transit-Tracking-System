"use client";
import { useSyncExternalStore } from "react";
export const DATA_SAVER_KEY = "smart-safar-data-saver";
function subscribe(callback) {
  window.addEventListener("smart-safar:data-saver", callback);
  window.addEventListener("storage", callback);
  navigator.connection?.addEventListener("change", callback);
  return () => { window.removeEventListener("smart-safar:data-saver", callback); window.removeEventListener("storage", callback); navigator.connection?.removeEventListener("change", callback); };
}
function snapshot() {
  let mode = "automatic";
  try { mode = localStorage.getItem(DATA_SAVER_KEY) || mode; } catch {}
  const connection = navigator.connection;
  const automatic = Boolean(connection?.saveData || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType));
  return mode + ":" + (mode === "on" || (mode !== "off" && automatic));
}
export function useDataSaver() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "automatic:pending");
  const [mode, status] = value.split(":");
  return { mode, enabled: status !== "false", ready: status !== "pending", setMode: (mode) => { try { localStorage.setItem(DATA_SAVER_KEY, mode); } catch {} window.dispatchEvent(new Event("smart-safar:data-saver")); } };
}
