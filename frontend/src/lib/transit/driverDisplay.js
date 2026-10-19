// Display safeguards only; the server remains the source of ETA and stop data.
export const DRIVER_LOCATION_MAX_AGE_MS = 120000;
export const DRIVER_MAX_NEXT_STOP_MINUTES = 120;
export function driverDisplay({ bus, eta, shiftActive, gpsStatus = {}, errors = {}, now = Date.now() }) {
  const updatedAt = new Date(bus?.lastLocationUpdate || "").getTime();
  const age = now - updatedAt;
  const fresh = Number.isFinite(age) && age >= 0 && age <= DRIVER_LOCATION_MAX_AGE_MS;
  const blocked = ["permission-denied", "error", "weak", "access-ended"].includes(gpsStatus.state);
  const available = shiftActive && fresh && !blocked && gpsStatus.state === "sharing";
  const gps = !shiftActive || ["stopped", "permission-denied", "access-ended"].includes(gpsStatus.state) ? "GPS Off"
    : blocked ? "GPS Weak"
    : available ? "GPS On"
    : gpsStatus.state === "starting" ? "GPS Starting"
    : bus?.lastLocationUpdate ? "GPS Weak" : "GPS Off";
  const minutes = eta?.etaMinutes;
  const validEta = typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0 && minutes <= DRIVER_MAX_NEXT_STOP_MINUTES;
  const nextStop = errors.eta ? null : eta?.nextStop?.stopName;
  return {
    gps,
    currentLocation: available && !errors.eta && eta?.currentStop?.stopName || "Location unavailable",
    nextStop: nextStop || "Not available",
    arrival: !shiftActive || errors.eta || !nextStop ? "Not available"
      : !available || !validEta ? "Not available"
      : minutes <= 1 ? "Arriving" : Math.round(minutes) + " min",
  };
}
