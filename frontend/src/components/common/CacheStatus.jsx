"use client";
import { useSyncExternalStore } from "react";
function subscribe(callback) { window.addEventListener("online", callback); window.addEventListener("offline", callback); return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); }; }
export function useOnline() { return useSyncExternalStore(subscribe, () => navigator.onLine, () => true); }
export function CacheStatus({ query }) {
  const online = useOnline();
  if (!query.dataUpdatedAt) return null;
  return <p className="my-3 text-xs text-[var(--muted)]" role="status">{!online ? "Offline ? saved information" : query.isError ? "Connection unavailable ? saved information" : query.isFetching ? "Saved information ? refreshing" : "Last updated"} ? {new Date(query.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{query.isError && online && <button type="button" className="ml-2 underline" onClick={() => query.refetch()}>Retry</button>}</p>;
}
