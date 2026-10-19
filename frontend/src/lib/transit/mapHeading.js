// A conservative fallback when the API has no compass heading or accuracy.
export const MAP_FIX_MAX_AGE = 30000;
const radians = value => value * Math.PI / 180;
export function normalizeHeading(value) {
  return Number.isFinite(value) ? ((value % 360) + 360) % 360 : null;
}
export function shortestTurn(from, to) {
  return ((to - from + 540) % 360 + 360) % 360 - 180;
}
export function freshMapFix(position, timestamp, now = Date.now()) {
  const time = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  return Array.isArray(position) && position.length >= 2 &&
    Number.isFinite(position[0]) && Math.abs(position[0]) <= 90 &&
    Number.isFinite(position[1]) && Math.abs(position[1]) <= 180 &&
    Number.isFinite(time) && time <= now && now - time <= MAP_FIX_MAX_AGE;
}
export function travelBearing(from, to) {
  const a = radians(from[0]), b = radians(to[0]), d = radians(to[1] - from[1]);
  return normalizeHeading(Math.atan2(Math.sin(d) * Math.cos(b),
    Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(d)) * 180 / Math.PI);
}
function distance(from, to) {
  const lat = radians(to[0] - from[0]), lng = radians(to[1] - from[1]);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(from[0])) * Math.cos(radians(to[0])) * Math.sin(lng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function nextMapHeading(previous, fix, now = Date.now()) {
  if (!freshMapFix(fix.position, fix.timestamp, now) || fix.stale ||
      (fix.accuracy != null && (!Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 100))) return previous;
  const timestamp = typeof fix.timestamp === "number" ? fix.timestamp : Date.parse(fix.timestamp);
  if (previous && timestamp <= previous.timestamp) return previous;
  const current = { ...previous, position: fix.position, timestamp, accuracy: fix.accuracy };
  // Stopped fixes retain direction, but advance the baseline to avoid accumulating drift.
  if (Number.isFinite(fix.speed) && fix.speed <= 1) return current;
  let heading = Number.isFinite(fix.heading) && fix.heading >= 0 && fix.heading < 360 ? fix.heading : null;
  if (heading == null && previous && timestamp - previous.timestamp <= MAP_FIX_MAX_AGE) {
    const minimum = Math.max(20, (previous.accuracy || 0) + (fix.accuracy || 0));
    if (distance(previous.position, fix.position) >= minimum) heading = travelBearing(previous.position, fix.position);
  }
  if (heading == null) return current;
  return { ...current, heading, rotation: previous?.heading == null ? heading : previous.rotation + shortestTurn(previous.heading, heading) };
}
export function canFollowBus(targetId, bus, now = Date.now()) {
  return targetId != null && String(targetId) === String(bus?.id || bus?._id) &&
    bus?.status === "active" && !bus.isSaved &&
    freshMapFix(bus.position || [bus.currentLocation?.latitude, bus.currentLocation?.longitude], bus.lastLocationUpdate, now);
}
