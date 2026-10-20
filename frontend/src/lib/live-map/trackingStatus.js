import { isValidPosition } from "../transit/coordinates";
import { hasFreshTelemetry } from "../transit/liveTelemetry";

export function trackingStatus(bus, now, deviceOnline = true) {
  const position = isValidPosition(bus?.position);
  const fresh = deviceOnline && hasFreshTelemetry(bus, now);
  const weak = fresh && Number.isFinite(bus.accuracy) && bus.accuracy > 100;
  return {
    label: !position ? "GPS unavailable" : weak ? "GPS weak" : fresh ? "Live GPS" : "Last known location",
    explanation: !deviceOnline ? "You are offline. Showing saved information." :
      !position ? "Bus found — location not available." :
      weak ? "Reported GPS accuracy is low." :
      !fresh ? "Waiting for a fresh GPS update. Driver connection status is unavailable." : "",
    canFollow: deviceOnline && fresh && !weak,
  };
}
