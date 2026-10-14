"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

export function CacheStatus({ query }) {
  const online = useOnline();
  const hasSavedData = Boolean(query.data && query.dataUpdatedAt);

  if (online && !query.isError) return null;
  if (!hasSavedData) return null;

  return <p className="cache-safety-notice" role="status">
    {!online ? "Offline - showing saved information." : "Connection unavailable - showing saved information."}
    {query.isError && online && <button type="button" className="ml-2 underline" onClick={() => query.refetch()}>Retry</button>}
  </p>;
}