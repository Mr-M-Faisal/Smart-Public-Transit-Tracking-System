import api from "../lib/api/axios";
import { API_PATHS } from "../config/api";

export const adminService = {
  getDashboard: (section, config = {}) => api.get(`${API_PATHS.admin}/dashboard`, { ...config, params: { section } }).then(({ data }) => data.sections),
  getDrivers: (config) => api.get(`${API_PATHS.admin}/drivers`, config).then(({ data }) => data),
  createDriver: (payload, config) => api.post(`${API_PATHS.admin}/drivers`, payload, config).then(({ data }) => data),
  updateDriver: (id, payload, config) => api.put(`${API_PATHS.admin}/drivers/${id}`, payload, config).then(({ data }) => data),
  deleteDriver: (id, config) => api.delete(`${API_PATHS.admin}/drivers/${id}`, config).then(({ data }) => data),
  getOverview: () => api.get(`${API_PATHS.admin}/overview`).then(({ data }) => data),
  getBookingAnalytics: () => api.get(`${API_PATHS.admin}/analytics/bookings`).then(({ data }) => data),
  getOccupancyAnalytics: () => api.get(`${API_PATHS.admin}/analytics/occupancy`).then(({ data }) => data),
  getReportsSummary: () => api.get(`${API_PATHS.admin}/analytics/reports`).then(({ data }) => data),
};
