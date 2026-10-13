"use client";
import { useContext, useSyncExternalStore } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { CacheReadyContext, LiveConnectionContext } from "../components/providers/TransitProvider";
const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;
function useHydrated() { return useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated); }
export function useTransitQuery(options, enabled = true) {
  const ready = useContext(CacheReadyContext);
  const hydrated = useHydrated();
  const query = useQuery({ ...options, enabled: ready && hydrated && enabled });
  // IndexedDB may finish before a streamed subtree hydrates. Its initial client
  // render must still match the server shell; client navigation stays instant.
  return { ...query, data: hydrated ? query.data : undefined, dataUpdatedAt: hydrated ? query.dataUpdatedAt : 0,
    isError: hydrated && query.isError, error: hydrated ? query.error : null,
    loading: enabled && (!hydrated || (query.data === undefined && (!ready || query.isFetching))) };
}
export function useTransitQueries(options) {
  const ready = useContext(CacheReadyContext);
  const hydrated = useHydrated();
  const queries = useQueries({ queries: options.map((option) => ({ ...option, enabled: ready && hydrated })) });
  return hydrated ? queries : queries.map((query) => ({ ...query, data: undefined }));
}

export function useLiveConnection() { return useContext(LiveConnectionContext); }
