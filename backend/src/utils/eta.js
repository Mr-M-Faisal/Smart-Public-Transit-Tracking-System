// A near-stationary speed does not support a useful arrival estimate.
// Keep the existing 20 km/h fallback only when no speed samples exist.
function estimateEtaMinutes(distanceKm, speeds = []) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  const samples = speeds.filter(speed => typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 && speed <= 144);
  const average = speeds.length ? (samples.length ? samples.reduce((sum, speed) => sum + speed, 0) / samples.length : 0) : 20;
  if (average < 1) return null;
  const minutes = distanceKm / average * 60;
  return Number.isFinite(minutes) && minutes <= 120 ? Math.round(minutes * 10) / 10 : null;
}
module.exports = { estimateEtaMinutes };
