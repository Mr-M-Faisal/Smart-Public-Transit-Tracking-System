import { isValidPosition } from "../transit/coordinates";
import { hasFreshTelemetry } from "../transit/liveTelemetry";

export const INITIAL_SEARCH = {
  searchTerm: "", selectedRoute: "All routes", selectedStatus: "All",
  selectedBusId: null, selectedStop: null, followBus: false, searchOpen: false,
  fitRevision: 0, cameraMode: "initial", cameraRevision: 0, interacted: false,
};
export const SEARCH_STATUSES = ["All", "Live", "Last known", "active", "idle", "maintenance"];
const text = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
export function routeSearchIndex(routeStops) {
  return new Map(routeStops.map(({route, stops}) => [String(route._id || route.id),
    text([route.routeName, route.startPoint, route.endPoint, ...stops.map(stop => stop.stopName)].join(" "))]));
}
export function searchBuses(buses, state, routeIndex, now) {
  const term = text(state.searchTerm);
  const matching = buses.filter(bus => !term || text([
    bus.busNumber, bus.number, bus.routeName, bus.routeStart, bus.routeEnd, bus.nextStop,
    routeIndex.get(String(bus.routeId)),
  ].join(" ")).includes(term));
  const results = matching.filter(bus =>
    (state.selectedRoute === "All routes" || String(bus.routeId) === String(state.selectedRoute)) &&
    (state.selectedStatus === "All" ||
      (state.selectedStatus === "Live" ? hasFreshTelemetry(bus, now) :
        state.selectedStatus === "Last known" ? !hasFreshTelemetry(bus, now) : bus.status === state.selectedStatus)));
  return { results, excluded: matching.length - results.length,
    markers: results.filter(bus => isValidPosition(bus.position)) };
}
export function busLocationLabel(bus, now) {
  if (!isValidPosition(bus.position)) return "Bus found \u2014 location unavailable.";
  if (hasFreshTelemetry(bus, now)) return "Live GPS";
  return bus.isSaved ? "Offline / last known location" : "Last known location";
}
export function liveBusSearchReducer(state, action) {
  switch (action.type) {
    case "restore":
      if (state.interacted) return state;
      return { ...state, searchTerm: typeof action.saved.searchTerm === "string" ? action.saved.searchTerm : "",
        selectedRoute: typeof action.saved.selectedRoute === "string" ? action.saved.selectedRoute : "All routes",
        selectedStatus: SEARCH_STATUSES.includes(action.saved.selectedStatus) ? action.saved.selectedStatus : "All",
        selectedBusId: action.saved.selectedBusId || null };
    case "filter":
      return { ...state, [action.field]: action.value, selectedBusId: null, selectedStop: null,
        followBus: false, searchOpen: action.field === "searchTerm" ? Boolean(action.value.trim()) : state.searchOpen, cameraMode: "idle", interacted: true };
    case "select":
      return { ...state, selectedBusId: String(action.id), selectedStop: null, followBus: false,
        searchOpen: action.collapse ? false : state.searchOpen,
        cameraMode: "select", cameraRevision: state.cameraRevision + 1, interacted: true };
    case "stop":
      return { ...state, selectedStop: action.stop, selectedBusId: null, followBus: false, cameraMode: "idle", interacted: true };
    case "close-selection":
      return { ...state, selectedStop: null, selectedBusId: null, followBus: false, cameraMode: "idle", interacted: true };
    case "catalogue":
      return state.selectedBusId && !action.ids.includes(String(state.selectedBusId))
        ? { ...state, selectedBusId: null, followBus: false, cameraMode: "idle" } : state;
    case "follow":
      return { ...state, followBus: state.followBus ? false : Boolean(state.selectedBusId && action.available), interacted: true };
    case "suspend":
      return state.followBus ? { ...state, followBus: false } : state;
    case "toggle-panel":
      return { ...state, searchOpen: !state.searchOpen, interacted: true };
    case "reset":
      return { ...INITIAL_SEARCH, searchOpen: state.searchOpen, cameraMode: "reset",
        fitRevision: state.fitRevision + 1, cameraRevision: state.cameraRevision + 1, interacted: true };
    default: return state;
  }
}
