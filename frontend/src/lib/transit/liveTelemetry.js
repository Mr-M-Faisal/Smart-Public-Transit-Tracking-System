export const LIVE_LOCATION_MAX_AGE_MS = 30000;
export function hasFreshTelemetry(bus, now = Date.now()) {
  const time = Date.parse(bus?.lastLocationUpdate || "");
  const position = bus?.position || [bus?.currentLocation?.latitude ?? bus?.latitude, bus?.currentLocation?.longitude ?? bus?.longitude];
  return bus?.status === "active" && !bus.isSaved && !bus.isOfflineCache &&
    Number.isFinite(position[0]) && Math.abs(position[0]) <= 90 &&
    Number.isFinite(position[1]) && Math.abs(position[1]) <= 180 &&
    Number.isFinite(time) && time <= now && now - time <= LIVE_LOCATION_MAX_AGE_MS;
}
export function mergeTelemetry(bus, update) {
  if (!update) return bus;
  const before = Date.parse(bus?.lastLocationUpdate || ""), after = Date.parse(update.lastLocationUpdate || "");
  // Shift-end events carry the same last GPS timestamp; never reject an equal-time idle event.
  if (Number.isFinite(before) && after === before && bus.status === "idle" && update.status === "active") return bus;
  if (Number.isFinite(before) && Number.isFinite(after) && after < before) return bus;
  const location = Object.hasOwn(update, "latitude") || Object.hasOwn(update, "currentLocation");
  if (location && !Number.isFinite(after) && update.status !== "idle") return bus;
  return { ...bus, ...update };
}
export function liveEtaLabel(minutes) {
  return typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0 || minutes > 120
    ? null : minutes <= 1 ? "Arriving" : Math.round(minutes) + " min";
}
