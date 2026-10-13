import axios from "axios";
import { API_URL, API_PATHS } from "../../config/api";
import { getAccessToken, clearAccessToken } from "../auth/token";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  const bookingRequest = config.url === API_PATHS.bookings || config.url?.startsWith(API_PATHS.bookings + "/");
  const mutation = ["post", "patch", "put", "delete"].includes(config.method?.toLowerCase());
  if (mutation && typeof navigator !== "undefined" && !navigator.onLine) {
    return Promise.reject(new axios.AxiosError("You're offline. Connect to the internet before making changes.", "ERR_OFFLINE", config));
  }
  if (!token && bookingRequest && mutation) {
    return Promise.reject(new axios.AxiosError("Please sign in to book a ticket.", "ERR_AUTH_REQUIRED", config));
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) clearAccessToken();
    const config = error.config;
    const transient = !error.response || [502, 503, 504].includes(error.response.status);
    if (config?.method?.toLowerCase() === "get" && !config._retried && transient
      && !["ERR_CANCELED", "ERR_OFFLINE", "ERR_AUTH_REQUIRED"].includes(error.code)
      && !config.signal?.aborted && (typeof navigator === "undefined" || navigator.onLine)) {
      config._retried = true;
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 250));
      return api(config);
    }
    return Promise.reject(error);
  },
);

export default api;
