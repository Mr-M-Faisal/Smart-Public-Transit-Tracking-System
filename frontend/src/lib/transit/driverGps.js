// Conservative foreground fix acceptance; no coordinates are synthesized.
export function usableDriverFix({ coords, timestamp }, now = Date.now()) {
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= 30000
    && Number.isFinite(coords?.latitude) && Math.abs(coords.latitude) <= 90
    && Number.isFinite(coords?.longitude) && Math.abs(coords.longitude) <= 180
    && Number.isFinite(coords?.accuracy) && coords.accuracy >= 0 && coords.accuracy <= 100;
}
export function isOlderLocation(incoming, current) {
  const next = Date.parse(incoming || ""), previous = Date.parse(current || "");
  return Number.isFinite(previous) && (!Number.isFinite(next) || next < previous);
}
