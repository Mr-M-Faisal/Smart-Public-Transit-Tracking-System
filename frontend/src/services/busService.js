import api from "../lib/api/axios";
import { API_PATHS } from "../config/api";

import { transitQueries, readQuery, invalidateTransit } from "../lib/query/transitQueries";

export const busService = {
  list: (params) => readQuery(transitQueries.buses(params)),
  get: (id) => readQuery({ ...transitQueries.bus(id), staleTime: 0 }),
  getEta: (id) => api.get(`${API_PATHS.buses}/${id}/eta`).then(({ data }) => data),
  create: (payload) => api.post(API_PATHS.buses, payload).then(async ({ data }) => { await invalidateTransit(["buses", "bus", "busMetadata"]); return data; }),
  update: (id, payload, config) => api.put(`${API_PATHS.buses}/${id}`, payload, config).then(async ({ data }) => { await invalidateTransit(["buses", "bus", "busMetadata"]); return data; }),
  delete: (id) => api.delete(`${API_PATHS.buses}/${id}`).then(async ({ data }) => { await invalidateTransit(["buses", "bus", "busMetadata"]); return data; }),
  startShift: (config) => api.post(`${API_PATHS.buses}/assigned/start-shift`, undefined, config).then(({ data }) => data),
  endShift: (config) => api.post(`${API_PATHS.buses}/assigned/end-shift`, undefined, config).then(({ data }) => data),
  updateLocation: (id, payload, config) => api.patch(`${API_PATHS.buses}/${id}/location`, payload, { ...config, timeout: 8000 }).then(({ data }) => data),
  startReturnTrip: (config) => api.post(`${API_PATHS.buses}/assigned/return-trip`, undefined, config).then(({ data }) => data),
  updateIndividualSeat: (id, label, action) => api.patch(`${API_PATHS.buses}/${id}/seats/${encodeURIComponent(label)}`, { action }).then(({ data }) => data),
  updateSeats: (id, availableSeats) => api.patch(`${API_PATHS.buses}/${id}/seats`, { availableSeats }).then(({ data }) => data),
};
