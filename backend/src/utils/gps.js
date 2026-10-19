const { ApiError } = require('./apiError');
const GPS_MAX_AGE_MS = 30000;
function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}
function parseGpsFix(body = {}, now = Date.now()) {
  const { latitude, longitude, speed, accuracy } = body || {};
  if (!validCoordinates(latitude, longitude)) throw new ApiError(400, 'Valid numeric latitude and longitude are required.');
  if (speed != null && (!Number.isFinite(speed) || speed < 0 || speed > 144)) throw new ApiError(400, 'Speed must be between 0 and 144 km/h.');
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100)) throw new ApiError(400, 'GPS accuracy must be within 100 metres.');
  // Legacy clients omit capture time; they are ordered by server receipt time.
  const timestamp = body.timestamp === undefined ? now : body.timestamp;
  if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp > GPS_MAX_AGE_MS) throw new ApiError(400, 'A fresh GPS capture timestamp is required.');
  return { latitude, longitude, speed, timestamp };
}
function hasFreshLocation(bus, now = Date.now()) {
  const timestamp = new Date(bus.lastLocationUpdate || '').getTime();
  return bus.status === 'active' && validCoordinates(bus.currentLocation?.latitude, bus.currentLocation?.longitude) &&
    Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= GPS_MAX_AGE_MS;
}
module.exports = { parseGpsFix, hasFreshLocation };
