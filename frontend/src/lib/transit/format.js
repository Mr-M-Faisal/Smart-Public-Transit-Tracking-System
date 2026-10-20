export function getTransitId(item) {
  return item?._id || item?.id || item?.busId;
}

export function getRouteId(route) {
  return route?._id || route?.id || route;
}

export function getRouteName(route) {
  return route?.routeName || route?.name || "Transit route";
}

export function getBusPosition(bus) {
  if (Array.isArray(bus.position)) return bus.position;
  if (Number.isFinite(bus.latitude) && Number.isFinite(bus.longitude)) return [bus.latitude, bus.longitude];
  if (bus.currentLocation?.latitude != null && bus.currentLocation?.longitude != null) {
    return [bus.currentLocation.latitude, bus.currentLocation.longitude];
  }
  return null;
}

export function getEtaLabel(eta) {
  if (!eta || eta.etaMinutes == null) return null;
  return eta.etaMinutes <= 1 ? "Arriving" : `${Math.round(eta.etaMinutes)} min`;
}

export function normalizeBus(bus, eta, routeMap = {}) {
  const route = { ...routeMap[getRouteId(bus.route)], ...(typeof bus.route === "object" && bus.route ? bus.route : {}) };
  const direction = eta?.direction === "return" || bus.direction === "return" ? "return" : "outbound";
  const origin = direction === "return" ? route?.endPoint : route?.startPoint;
  const destination = direction === "return" ? route?.startPoint : route?.endPoint;
  return {
    ...bus,
    id: getTransitId(bus),
    number: bus.busNumber || bus.number || "Transit bus",
    routeId: route._id || route.id || getRouteId(bus.route),
    route: getRouteName(route),
    routeName: getRouteName(route),
    routeStart: route?.startPoint,
    routeEnd: route?.endPoint,
    direction,
    directionLabel: origin && destination ? `${origin} → ${destination}` : null,
    status: bus.status || "Status unavailable",
    eta: getEtaLabel(eta) || bus.eta || null,
    nextStop: eta?.nextStop?.stopName || bus.nextStop || null,
    nextStopId: eta?.nextStop?._id || bus.nextStopId || null,
    position: getBusPosition(bus),
  };
}

export function getOccupancy(bus) {
  return bus.occupancy || null;
}
