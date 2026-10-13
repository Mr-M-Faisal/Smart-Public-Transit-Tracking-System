import { QueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { API_PATHS } from "../../config/api";
import { readPublicQueries, savePublicQueries, readCachedRoutes, readTransitSnapshot } from "../live-map/liveMapStorage";

let browserClient;
let restoration;
export function getQueryClient() {
  const create = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000, gcTime: 30 * 60000, refetchOnWindowFocus: false, refetchOnReconnect: false, networkMode: "always" }, mutations: { retry: false } } });
  if (typeof window === "undefined") return create();
  return browserClient ||= create();
}
const publicKinds = new Set(["routes", "geometry", "route", "stops", "busMetadata"]);
export function isPublicQuery(query) { return Array.isArray(query?.queryKey) && query.queryKey[0] === "transit" && publicKinds.has(query.queryKey[1]); }
export function restoreQueries() {
  if (typeof window === "undefined") return Promise.resolve();
  return restoration ||= (async () => {
    const client = getQueryClient();
    const snapshot = await readPublicQueries();
    for (const entry of (Array.isArray(snapshot?.data) ? snapshot.data : [])) {
      if (!isPublicQuery(entry) || !entry.updatedAt || client.getQueryData(entry.queryKey) !== undefined) continue;
      client.setQueryData(entry.queryKey, entry.data, { updatedAt: entry.updatedAt });
    }
    // Upgrade the existing route catalogue in place; no new IndexedDB schema.
    if (!Array.isArray(snapshot?.data)) {
      const legacyMap = await readTransitSnapshot();
      if (legacyMap?.data?.routes?.length) {
        client.setQueryData(["transit", "geometry", "all"], legacyMap.data.routes, { updatedAt: legacyMap.cachedAt });
        for (const entry of legacyMap.data.routeStops || []) {
          const id = String(entry.route?._id || entry.route?.id || "");
          if (id) client.setQueryData(["transit", "stops", id], entry.stops, { updatedAt: legacyMap.cachedAt });
        }
      }
      const legacy = await readCachedRoutes();
      if (legacy?.data?.routes?.length) client.setQueryData(["transit", "routes", {}], legacy.data.routes, { updatedAt: legacy.cachedAt });
      for (const [id, value] of Object.entries(legacy?.data?.details || {})) {
        if (value.route) client.setQueryData(["transit", "route", id], value.route, { updatedAt: value.cachedAt });
        if (value.stops) client.setQueryData(["transit", "stops", id], value.stops, { updatedAt: value.cachedAt });
      }
    }
  })();
}
export function persistQueries() {
  const entries = getQueryClient().getQueryCache().findAll().filter(isPublicQuery)
    .filter((query) => query.state.data !== undefined && !query.state.isInvalidated && ![404, 410].includes(query.state.error?.response?.status))
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt).slice(0, 150)
    .map((query) => ({ queryKey: query.queryKey, data: query.state.data, updatedAt: query.state.dataUpdatedAt }));
  return savePublicQueries(entries);
}
function options(kind, id, url, params, staleTime = 60000) {
  return { queryKey: ["transit", kind, id], staleTime, queryFn: async ({ signal }) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("Offline. Showing saved information where available.");
    const data = (await api.get(url, { params, signal })).data;
    if (kind === "buses" || kind === "bus") {
      for (const bus of (Array.isArray(data) ? data : [data])) {
        const { _id, busNumber, route, capacity } = bus;
        getQueryClient().setQueryData(["transit", "busMetadata", String(_id)], { _id, busNumber, route, capacity, isOfflineCache: true });
      }
    }
    return data;
  } };
}
export const transitQueries = {
  routes: (params = {}) => options("routes", params, API_PATHS.routes, params),
  geometry: () => options("geometry", "all", API_PATHS.routes, { includeGeometry: true }, 15 * 60000),
  route: (id) => options("route", String(id), API_PATHS.routes + "/" + id, undefined, 15 * 60000),
  stops: (id) => options("stops", String(id), API_PATHS.stops + "/route/" + id),
  buses: (params = {}) => options("buses", params, API_PATHS.buses, params, 15000),
  busMetadata: (id) => ({ queryKey: ["transit", "busMetadata", String(id)], queryFn: () => null, staleTime: Infinity }),
  bus: (id) => options("bus", String(id), API_PATHS.buses + "/" + id, undefined, 10000),
  eta: (id) => options("eta", String(id), API_PATHS.buses + "/" + id + "/eta", undefined, 10000),
  routeAlerts: (id) => options("routeAlerts", String(id), API_PATHS.alerts + "/route/" + id, undefined, 15000),
  alerts: (scope) => options("alerts", scope, API_PATHS.alerts + "/active", undefined, 15000),
};
export async function readQuery(options) {
  await restoreQueries();
  const client = getQueryClient();
  // Public reference data is usable offline; operational callers still require
  // fresh buses/seats and never silently receive persisted live state.
  if (typeof navigator !== "undefined" && !navigator.onLine && isPublicQuery(options)) {
    const saved = client.getQueryData(options.queryKey);
    if (saved !== undefined) return saved;
  }
  return client.fetchQuery(options);
}
export async function invalidateTransit(kinds) {
  await restoreQueries();
  const client = getQueryClient();
  const predicate = (query) => query.queryKey[0] === "transit" && kinds.includes(query.queryKey[1]);
  await client.cancelQueries({ predicate });
  await client.invalidateQueries({ predicate, refetchType: "none" });
  await persistQueries();
  await client.refetchQueries({ predicate, type: "active" });
}
