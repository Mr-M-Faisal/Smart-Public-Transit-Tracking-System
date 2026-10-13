import api from "../lib/api/axios";
import { API_PATHS } from "../config/api";

import { transitQueries, readQuery, invalidateTransit } from "../lib/query/transitQueries";
const clearStopsCache = () => invalidateTransit(["stops", "route", "geometry", "routes"]);
const listByRoute = (id, config) => config?.signal ? api.get(`${API_PATHS.stops}/route/${id}`, config).then(({ data }) => data) : readQuery(transitQueries.stops(id));

export const stopService = {
  listByRoute,
  listGrouped: () => api.get(`${API_PATHS.stops}/grouped`).then(({ data }) => data),
  get: (id) => api.get(`${API_PATHS.stops}/${id}`).then(({ data }) => data),
  create: (payload) => api.post(API_PATHS.stops, payload).then(async ({ data }) => { await clearStopsCache(payload.route?._id || payload.route); return data; }),
  update: (id, payload) => api.put(`${API_PATHS.stops}/${id}`, payload).then(async ({ data }) => { await clearStopsCache(); return data; }),
  delete: (id, assignment = {}) => api.delete(`${API_PATHS.stops}/${id}`, { params: assignment }).then(async ({ data }) => { await clearStopsCache(); return data; }),
  invalidateCache: clearStopsCache,
};
