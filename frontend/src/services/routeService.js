import api from "../lib/api/axios";
import { API_PATHS } from "../config/api";
import { transitQueries, readQuery, invalidateTransit } from "../lib/query/transitQueries";
const invalidate = () => invalidateTransit(["routes", "geometry", "route", "stops"]);
export const routeService = {
  list: (params) => readQuery(transitQueries.routes(params)),
  listWithGeometry: () => readQuery(transitQueries.geometry()),
  get: (id) => readQuery(transitQueries.route(id)),
  create: async (payload) => { const { data } = await api.post(API_PATHS.routes, payload); await invalidate(); return data; },
  update: async (id, payload) => { const { data } = await api.put(API_PATHS.routes + "/" + id, payload); await invalidate(); return data; },
  delete: async (id) => { const { data } = await api.delete(API_PATHS.routes + "/" + id); await invalidate(); return data; },
  invalidateCache: invalidate,
};
