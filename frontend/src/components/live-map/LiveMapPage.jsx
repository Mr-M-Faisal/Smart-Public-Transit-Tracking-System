"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { MapPinned, Wifi, WifiOff } from "lucide-react";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { CardBackdrop } from "../common/CardBackdrop";
import { RouteCard } from "../route/RouteCard";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { ClientTransitMap } from "../map/MapShell";
import { BusMarker } from "../map/MapShell";
import { StopMarker } from "../map/MapShell";
import { RoutePolyline } from "../map/MapShell";
import { MapControls } from "../map/MapShell";
import { MapViewport } from "../map/MapShell";
import { LiveMapLegend } from "../map/LiveMapLegend";
import { UserLocationMarker } from "../map/MapShell";
import { StopDetailsPanel } from "../map/StopDetailsPanel";
import { BusTrackingSheet } from "./BusTrackingSheet";
import { trackingStatus } from "../../lib/live-map/trackingStatus";
import { useDataSaver } from "../../hooks/useDataSaver";
import { useLiveBuses } from "../../hooks/useLiveBuses";
import { useSocket } from "../../hooks/useSocket";
import { getRouteId, normalizeBus, getBusPosition } from "../../lib/transit/format";
import { readLiveMapState, saveLiveMapState } from "../../lib/live-map/liveMapStorage";

import { useTransitQuery, useTransitQueries } from "../../hooks/useTransitQuery";
import { transitQueries } from "../../lib/query/transitQueries";
import { CacheStatus } from "../common/CacheStatus";

import { mergeTelemetry, liveEtaLabel } from "../../lib/transit/liveTelemetry";

import { LiveBusSearch } from "./LiveBusSearch";
import { INITIAL_SEARCH, liveBusSearchReducer, searchBuses, routeSearchIndex } from "../../lib/live-map/liveBusSearch";
import { isValidPosition } from "../../lib/transit/coordinates";

const emptyList = [];

const STALE_AFTER_MS = 30000;

function routeGeometry(route, direction = "outbound") {
  const points = route?.geometry?.[direction === "return" ? "return" : "outbound"];
  return Array.isArray(points) && points.length > 1 ? points.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])) : [];
}

function isStale(bus, now) {
  if (bus.isSaved) return true;
  if (bus.status !== "active") return false;
  if (!bus.lastLocationUpdate) return true;
  const updated = new Date(bus.lastLocationUpdate).getTime();
  return !Number.isFinite(updated) || updated > now || now - updated > STALE_AFTER_MS;
}

export default function LiveMapPage() {
  const socket = useSocket();
  const dataSaver = useDataSaver();
  const liveUpdates = useLiveBuses([]);
  const routesQuery = useTransitQuery(transitQueries.geometry());
  const busesQuery = useTransitQuery(transitQueries.buses());
  const routes = routesQuery.data || emptyList;
  const denied = [401, 403, 404].includes(busesQuery.error?.response?.status || busesQuery.error?.status);
  const busData = denied ? emptyList : busesQuery.data || emptyList;
  const stopsQueries = useTransitQueries(routes.map((route) => transitQueries.stops(getRouteId(route))));
  const etaQueries = useTransitQueries(busData.map((bus) => transitQueries.eta(bus._id)));
  const routeStops = routes.map((route, index) => ({ route, stops: stopsQueries[index]?.data || [] }));
  const routeMap = Object.fromEntries(routes.map((route) => [getRouteId(route), route]));
  const apiBuses = busData.map((bus, index) => normalizeBus(bus, !etaQueries[index]?.isStale ? etaQueries[index]?.data : null, routeMap));
  const dataLoading = routesQuery.loading || busesQuery.loading;
  const dataError = routesQuery.isError || busesQuery.isError;
  const loadData = () => { routesQuery.refetch(); busesQuery.refetch(); stopsQueries.forEach((query) => query.refetch()); etaQueries.forEach((query) => query.refetch()); };
  const [search, dispatch] = useReducer(liveBusSearchReducer, INITIAL_SEARCH);
  const { searchTerm, selectedRoute, selectedStatus, selectedBusId, selectedStop, followBus } = search;
  const [connection, setConnection] = useState("connecting");
  const [userLocation, setUserLocation] = useState(null);
  const [locationNotice, setLocationNotice] = useState("");
  const [tileError, setTileError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let active = true;
    readLiveMapState().then((savedState) => {
      if (!active) return;
      const saved = savedState?.data || {};
      dispatch({ type: "restore", saved: { ...saved, selectedRoute: new URLSearchParams(window.location.search).get("route") || saved.selectedRoute || "All routes" } });
      setCacheReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    const goOffline = () => { setOnline(false); setConnection("offline"); };
    const goOnline = () => { setOnline(true); setConnection("connecting"); if (!socket.connected) socket.connect(); };
    if (!navigator.onLine) queueMicrotask(goOffline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, [socket]);

  useEffect(() => {
    const markLive = () => setConnection("live"); const markOffline = () => setConnection("offline"); const markConnecting = () => setConnection("connecting");
    socket.on("connect", markLive); socket.on("disconnect", markOffline); socket.on("connect_error", markOffline); socket.io.on("reconnect_attempt", markConnecting);
    if (socket.connected) markLive();
    return () => { socket.off("connect", markLive); socket.off("disconnect", markOffline); socket.off("connect_error", markOffline); socket.io.off("reconnect_attempt", markConnecting); };
  }, [socket]);

  const buses = (() => apiBuses.map((bus) => {
    const update = liveUpdates.find((item) => String(item.id || item._id || item.busId) === String(bus.id));
    const saved = !online || busesQuery.isError || busesQuery.isStale || connection !== "live";
    if (!update || mergeTelemetry(bus, update) === bus) return { ...bus, isSaved: saved };
    const direction = ["return", "outbound"].includes(update.direction) ? update.direction : bus.direction;
    const origin = direction === "return" ? bus.routeEnd : bus.routeStart;
    const destination = direction === "return" ? bus.routeStart : bus.routeEnd;
    return { ...bus, ...update, isSaved: saved, direction, directionLabel: origin && destination ? `${origin} → ${destination}` : bus.directionLabel, nextStop: update.nextStop?.stopName || update.nextStop || bus.nextStop, nextStopId: update.nextStop?._id || bus.nextStopId, eta: Object.hasOwn(update, "etaMinutes") ? liveEtaLabel(update.etaMinutes) : bus.eta, distanceKm: update.distanceKm ?? bus.distanceKm, terminalReached: update.terminalReached ?? bus.terminalReached, position: getBusPosition(update) || bus.position };
  }))();
  const selectedBus = buses.find((bus) => String(bus.id) === String(selectedBusId)) || null;
  const routeOptions = routes.map((route) => ({ id: getRouteId(route), label: route.routeName || route.routeCode || "Route" }));
  const { results: filteredBuses, markers, excluded } = searchBuses(buses, search, routeSearchIndex(routeStops), now);
  const followAvailable = selectedBus && trackingStatus(selectedBus, now, online).canFollow && markers.some(bus => String(bus.id) === String(selectedBus.id));
  useEffect(() => { if (followBus && !followAvailable) dispatch({ type: "suspend" }); }, [followBus, followAvailable]);
  const toggleFollow = () => dispatch({ type: "follow", available: followAvailable });
  useEffect(() => {
    if (denied || busesQuery.data) dispatch({ type: "catalogue", ids: denied ? [] : busesQuery.data.map(bus => String(bus._id || bus.id)) });
  }, [busesQuery.data, selectedBusId, denied]);
  const selectedRouteId = selectedBus?.routeId || (selectedRoute === "All routes" ? null : selectedRoute);

  const displayRouteIds = selectedRouteId ? new Set([selectedRouteId]) : new Set(filteredBuses.map(bus => bus.routeId));
  const routeLines = routeStops.filter(({ route }) => displayRouteIds.has(getRouteId(route))).map(({ route }) => ({ id: getRouteId(route), positions: routeGeometry(route, selectedBus?.routeId === getRouteId(route) ? selectedBus.direction : "outbound") })).filter((item) => item.positions.length > 1);
  const visibleStops = routeStops.filter(({ route }) => displayRouteIds.has(getRouteId(route))).flatMap(({ route, stops }) => stops.map((stop) => ({ ...stop, id: stop._id, name: stop.stopName, routeId: getRouteId(route), routeName: route.routeName, position: [stop.latitude, stop.longitude] }))).filter((stop) => Number.isFinite(stop.position[0]) && Number.isFinite(stop.position[1]));
  const mapPositions = buses.filter((bus) => isValidPosition(bus.position)).map((bus) => bus.position);

  const routeCards = routes.slice(0, 2).map((route) => { const id = getRouteId(route); const stops = routeStops.find((item) => getRouteId(item.route) === id)?.stops || []; return { ...route, id, stops: stops.length, activeBuses: buses.filter((bus) => bus.routeId === id && bus.status === "active").length }; });

  function locateUser(map) {
    dispatch({ type: "suspend" });
    if (!navigator.geolocation) { setLocationNotice("Your device cannot provide a location."); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => { const position = [coords.latitude, coords.longitude]; setUserLocation({ position, accuracy: coords.accuracy }); setLocationNotice(""); map.setView(position, 15); }, () => setLocationNotice("Location permission is unavailable. You can continue using the map."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
  function showAllBuses() { dispatch({ type: "reset" }); }
  const selectBus = useCallback((bus) => { dispatch({ type: "select", id: bus.id, collapse: true }); }, []);
  useEffect(() => {
    if (!cacheReady) return;
    saveLiveMapState({ searchTerm, selectedRoute, selectedStatus, selectedBusId });
  }, [cacheReady, searchTerm, selectedBusId, selectedRoute, selectedStatus]);

  return <div className="live-map-page min-h-screen overflow-x-hidden bg-[var(--background)]"><Navbar /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><header className="premium-card premium-card--primary premium-card--imagery flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-end sm:p-7"><CardBackdrop visual="transit" priority /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Live transit</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">Track buses in real time.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">See active buses, road-following routes, stops and estimated arrival times across Faisalabad.</p></div><Badge tone={connection === "live" ? "success" : connection === "offline" ? "danger" : "warning"}>{connection === "live" ? "Live network" : !online ? "Device offline" : connection === "offline" ? "Updates unavailable" : "Connecting"}</Badge></header>
    <CacheStatus query={routesQuery} />{connection === "offline" && <Notice icon={<WifiOff size={17} />} text={!online ? "You are offline. Showing saved information." : "Live updates are unavailable. Showing last known information."} />}{connection === "connecting" && <Notice icon={<Wifi size={16} />} text="Connecting to live transit updates..." />}{locationNotice && <Notice text={locationNotice} />}
    <LiveBusSearch state={search} dispatch={dispatch} routes={routeOptions} results={filteredBuses} excluded={excluded} now={now} loading={dataLoading && !buses.length} error={dataError && !buses.length} onRetry={loadData} onSelect={selectBus} />
    <section className="mt-6 grid gap-6 "><div className="map-v2-surface relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1 shadow-[0_14px_36px_rgba(15,23,42,0.08)]"><div className="relative"><ClientTransitMap center={[31.416, 73.078]} zoom={13} onTileError={() => setTileError(true)} className="h-[min(58vh,520px)] min-h-[360px] rounded-xl"><MapViewport disableAnimation={dataSaver.enabled} positions={mapPositions} fitKey={search.fitRevision} focusKey={search.cameraMode === "select" ? search.cameraRevision : null} focusPosition={search.cameraMode === "select" ? selectedBus?.position : null} followPosition={followBus && followAvailable ? selectedBus.position : null} onFollowSuspend={() => dispatch({ type: "suspend" })} persistViewport />{routeLines.map((line) => <RoutePolyline key={line.id} positions={line.positions} color={line.id === selectedRouteId ? "var(--primary)" : "var(--primary-border)"} showArrows={line.id === selectedRouteId} />)}{markers.map((bus) => <BusMarker key={bus.id} position={bus.position} bus={bus} selected={bus.id === selectedBus?.id} stale={isStale(bus, now)} onSelect={selectBus} />)}{visibleStops.map((stop) => <StopMarker key={`${stop.routeId}-${stop.routeStopId || stop.id}`} position={stop.position} stop={stop} next={String(stop.id) === String(selectedBus?.nextStopId)} selected={String(stop.id) === String(selectedStop?.id)} onSelect={(stop) => dispatch({ type: "stop", stop })} />)}<UserLocationMarker location={userLocation} /><MapControls onLocate={locateUser} onShowAll={showAllBuses} onToggleFollow={selectedBus ? toggleFollow : null} followActive={followBus} followDisabled={!followBus && !followAvailable} /></ClientTransitMap><LiveMapLegend showUser={Boolean(userLocation)} /></div>{dataLoading && !buses.length && <div className="pointer-events-none absolute left-4 top-4 z-[450] rounded-xl bg-[var(--card)] px-4 py-2 text-sm shadow-sm" role="status">Loading transit information...</div>}{tileError && <div className="absolute inset-x-4 top-4 z-[500] rounded-xl bg-[var(--card)] p-3 text-sm shadow-lg">Unable to load all map tiles. <button type="button" className="font-semibold text-[var(--primary-ink)] underline" onClick={() => setTileError(false)}>Try again</button></div>}{selectedBus && <div className="map-live-sheet absolute bottom-4 left-4 right-4 z-[500] sm:max-w-sm" role="region" aria-label={`Bus details for ${selectedBus.number || selectedBus.busNumber || "selected bus"}`}><BusTrackingSheet key={selectedBus.id} bus={selectedBus} now={now} online={online} followActive={followBus} onToggleFollow={toggleFollow} hiddenByFilters={!filteredBuses.includes(selectedBus)} onClose={() => dispatch({ type: "close-selection" })} /></div>}{selectedStop && <div className="map-live-sheet absolute bottom-4 left-4 right-4 z-[500] sm:max-w-sm" role="region" aria-label={`Stop details for ${selectedStop.name || selectedStop.stopName || "selected stop"}`}><StopDetailsPanel stop={selectedStop} onClose={() => dispatch({ type: "close-selection" })} /></div>}</div>
</section>
    {selectedRouteId && !routeLines.length && <Card className="mt-4 p-4 text-sm text-[var(--muted)]">Road geometry for this route is still being prepared. Stops remain visible, but no substitute line is shown.</Card>}
    <section className="mt-7"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Network guide</p><h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">Stops &amp; Popular Routes</h2></div><div className="grid gap-4 md:grid-cols-3"><Card treatment="stat" className="flex min-h-[158px] items-center p-5"><div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]"><MapPinned size={18} /></span><p className="mt-4 text-2xl font-bold text-[var(--foreground)]">{visibleStops.length}</p><p className="text-sm font-semibold text-[var(--foreground)]">Stops visible</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Tap a stop for route information.</p></div></Card>{routeCards.map((route) => <RouteCard key={route.id} route={route} />)}</div></section></main><Footer /></div>;
}

function Notice({ icon, text }) { return <div className="mt-6 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">{icon}{text}</div>; }
