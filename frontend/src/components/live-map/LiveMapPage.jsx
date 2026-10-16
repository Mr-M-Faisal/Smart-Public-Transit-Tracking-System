"use client";

import { useEffect, useState } from "react";
import { LocateFixed, MapPinned, Search, Wifi, WifiOff, X } from "lucide-react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { CardBackdrop } from "../common/CardBackdrop";
import { EmptyState } from "../common/EmptyState";
import { SectionSkeleton } from "../common/SectionSkeleton";
import { BusCard } from "../bus/BusCard";
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
import { BusDetailsPanel } from "../map/BusDetailsPanel";
import { useLiveBuses } from "../../hooks/useLiveBuses";
import { useSocket } from "../../hooks/useSocket";
import { getRouteId, normalizeBus, getBusPosition } from "../../lib/transit/format";
import { readLiveMapState, saveLiveMapState } from "../../lib/live-map/liveMapStorage";

import { useTransitQuery, useTransitQueries } from "../../hooks/useTransitQuery";
import { transitQueries } from "../../lib/query/transitQueries";
import { CacheStatus } from "../common/CacheStatus";

const emptyList = [];
const statusOptions = ["All", "active", "idle", "maintenance"];
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
  const liveUpdates = useLiveBuses([]);
  const routesQuery = useTransitQuery(transitQueries.geometry());
  const busesQuery = useTransitQuery(transitQueries.buses());
  const routes = routesQuery.data || emptyList;
  const busData = busesQuery.data || emptyList;
  const stopsQueries = useTransitQueries(routes.map((route) => transitQueries.stops(getRouteId(route))));
  const etaQueries = useTransitQueries(busData.map((bus) => transitQueries.eta(bus._id)));
  const routeStops = routes.map((route, index) => ({ route, stops: stopsQueries[index]?.data || [] }));
  const routeMap = Object.fromEntries(routes.map((route) => [getRouteId(route), route]));
  const apiBuses = busData.map((bus, index) => normalizeBus(bus, !etaQueries[index]?.isStale ? etaQueries[index]?.data : null, routeMap));
  const dataLoading = routesQuery.loading || busesQuery.loading;
  const dataError = routesQuery.isError || busesQuery.isError;
  const loadData = () => { routesQuery.refetch(); busesQuery.refetch(); stopsQueries.forEach((query) => query.refetch()); etaQueries.forEach((query) => query.refetch()); };
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("All routes");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [followBus, setFollowBus] = useState(false);
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
      setSearchTerm(saved.searchTerm || "");
      setSelectedRoute(new URLSearchParams(window.location.search).get("route") || saved.selectedRoute || "All routes");
      setSelectedStatus(saved.selectedStatus || "All");
      setSelectedBusId(saved.selectedBusId || null);
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

  useEffect(() => {
    const watch = () => apiBuses.forEach((bus) => { if (bus.id) socket.emit("watchBus", bus.id); });
    socket.on("connect", watch); if (socket.connected) watch();
    return () => socket.off("connect", watch);
  }, [socket, apiBuses]);

  const buses = (() => apiBuses.map((bus) => {
    if (!online || busesQuery.isError || busesQuery.isStale || connection !== "live") return { ...bus, eta: null, occupancy: null, availableSeats: null, isSaved: true, lastKnownAt: bus.lastLocationUpdate, lastLocationUpdate: new Date(0).toISOString() };
    const update = liveUpdates.find((item) => String(item.id || item._id || item.busId) === String(bus.id));
    if (!update) return bus;
    const direction = update.direction === "return" ? "return" : bus.direction;
    const origin = direction === "return" ? bus.routeEnd : bus.routeStart;
    const destination = direction === "return" ? bus.routeStart : bus.routeEnd;
    return { ...bus, ...update, direction, directionLabel: origin && destination ? `${origin} → ${destination}` : bus.directionLabel, nextStop: update.nextStop?.stopName || update.nextStop || bus.nextStop, nextStopId: update.nextStop?._id || bus.nextStopId, eta: update.etaMinutes != null ? (update.etaMinutes <= 1 ? "Arriving" : `${Math.round(update.etaMinutes)} min`) : bus.eta, distanceKm: update.distanceKm ?? bus.distanceKm, terminalReached: update.terminalReached ?? bus.terminalReached, position: getBusPosition(update) || bus.position };
  }))();
  const selectedBus = buses.find((bus) => String(bus.id) === String(selectedBusId)) || null;
  const routeOptions = routes.map((route) => ({ id: getRouteId(route), label: route.routeName || route.routeCode || "Route" }));
  const matchingRouteIds = (() => {
    const term = searchTerm.trim().toLowerCase(); if (!term) return new Set(routes.map(getRouteId));
    return new Set(routes.filter((route) => `${route.routeName || ""} ${route.startPoint || ""} ${route.endPoint || ""} ${(routeStops.find((item) => getRouteId(item.route) === getRouteId(route))?.stops || []).map((stop) => stop.stopName).join(" ")}`.toLowerCase().includes(term)).map(getRouteId));
  })();
  const filteredBuses = (() => {
    const term = searchTerm.trim().toLowerCase();
    return buses.filter((bus) => {
      const matchesTerm = !term || `${bus.number} ${bus.route} ${bus.routeName} ${bus.nextStop || ""}`.toLowerCase().includes(term) || matchingRouteIds.has(bus.routeId);
      return matchesTerm && (selectedRoute === "All routes" || bus.routeId === selectedRoute) && (selectedStatus === "All" || bus.status === selectedStatus);
    });
  })();
  const selectedRouteId = selectedBus?.routeId || (selectedRoute === "All routes" ? null : selectedRoute);
  const selectedGeometry = routeStops.find(({ route }) => getRouteId(route) === selectedRouteId);
  const displayRouteIds = selectedRouteId ? new Set([selectedRouteId]) : searchTerm.trim() ? matchingRouteIds : new Set(routes.map(getRouteId));
  const routeLines = routeStops.filter(({ route }) => displayRouteIds.has(getRouteId(route))).map(({ route }) => ({ id: getRouteId(route), positions: routeGeometry(route, selectedBus?.routeId === getRouteId(route) ? selectedBus.direction : "outbound") })).filter((item) => item.positions.length > 1);
  const visibleStops = routeStops.filter(({ route }) => displayRouteIds.has(getRouteId(route))).flatMap(({ route, stops }) => stops.map((stop) => ({ ...stop, id: stop._id, name: stop.stopName, routeId: getRouteId(route), routeName: route.routeName, position: [stop.latitude, stop.longitude] }))).filter((stop) => Number.isFinite(stop.position[0]) && Number.isFinite(stop.position[1]));
  const mapPositions = buses.filter((bus) => bus.status === "active" && bus.position).map((bus) => bus.position);
  const selectedStops = selectedGeometry?.stops || [];
  const routeCards = routes.slice(0, 2).map((route) => { const id = getRouteId(route); const stops = routeStops.find((item) => getRouteId(item.route) === id)?.stops || []; return { ...route, id, stops: stops.length, activeBuses: buses.filter((bus) => bus.routeId === id && bus.status === "active").length }; });

  function locateUser(map) {
    if (!navigator.geolocation) { setLocationNotice("Your device cannot provide a location."); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => { const position = [coords.latitude, coords.longitude]; setUserLocation({ position, accuracy: coords.accuracy }); setLocationNotice(""); map.setView(position, 15); }, () => setLocationNotice("Location permission is unavailable. You can continue using the map."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
  function showAllBuses(map) { if (mapPositions.length) map.fitBounds(mapPositions, { padding: [32, 32], maxZoom: 14 }); setSelectedBusId(null); setSelectedStop(null); setFollowBus(false); }
  function selectBus(bus) { setSelectedBusId(bus.id); setSelectedRoute(bus.routeId || "All routes"); setSelectedStop(null); setFollowBus(false); }
  useEffect(() => {
    if (!cacheReady) return;
    saveLiveMapState({ searchTerm, selectedRoute, selectedStatus, selectedBusId });
  }, [cacheReady, searchTerm, selectedBusId, selectedRoute, selectedStatus]);

  return <div className="live-map-page min-h-screen overflow-x-hidden bg-[var(--background)]"><Navbar /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><header className="premium-card premium-card--primary premium-card--imagery flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-end sm:p-7"><CardBackdrop visual="transit" priority /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Live transit</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">Track buses in real time.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">See active buses, road-following routes, stops and estimated arrival times across Faisalabad.</p></div><Badge tone={connection === "live" ? "success" : connection === "offline" ? "danger" : "warning"}>{connection === "live" ? "Live network" : connection === "offline" ? "Offline" : "Connecting"}</Badge></header>
    <CacheStatus query={routesQuery} />{connection === "offline" && <Notice icon={<WifiOff size={17} />} text="Live updates are unavailable. Showing the latest transit information." />}{connection === "connecting" && <Notice icon={<Wifi size={16} />} text="Connecting to live transit updates..." />}{locationNotice && <Notice text={locationNotice} />}
    <Card treatment="operational" className="mobile-map-filters mt-6 p-3 sm:p-4"><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]"><label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5"><Search size={18} className="shrink-0 text-[var(--primary-ink)]" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" placeholder="Search bus, route or stop..." aria-label="Search bus, route or stop" />{searchTerm && <button type="button" onClick={() => setSearchTerm("")} className="text-[var(--muted)]" aria-label="Clear search"><X size={16} /></button>}</label><select value={selectedRoute} onChange={(event) => { setSelectedRoute(event.target.value); setSelectedBusId(null); setFollowBus(false); }} className="field-input min-h-11 text-sm" aria-label="Route filter"><option>All routes</option>{routeOptions.map((route) => <option key={route.id} value={route.id}>{route.label}</option>)}</select><select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="field-input min-h-11 text-sm" aria-label="Bus status filter">{statusOptions.map((status) => <option key={status}>{status}</option>)}</select><Button type="button" variant="secondary" className="min-h-11 gap-2" onClick={() => { setSearchTerm(""); setSelectedRoute("All routes"); setSelectedStatus("All"); setSelectedBusId(null); setFollowBus(false); }}><LocateFixed size={16} /> Reset</Button></div></Card>
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)] xl:items-start"><div className="map-v2-surface relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1 shadow-[0_14px_36px_rgba(15,23,42,0.08)]"><div className="relative"><ClientTransitMap center={[31.416, 73.078]} zoom={13} onTileError={() => setTileError(true)} className="h-[min(58vh,520px)] min-h-[360px] rounded-xl"><MapViewport positions={selectedBus?.position ? [selectedBus.position] : mapPositions} focusKey={`${selectedBus?.id || selectedRoute}-${filteredBuses.length}`} focusPosition={selectedBus?.position} followPosition={followBus ? selectedBus?.position : null} persistViewport />{routeLines.map((line) => <RoutePolyline key={line.id} positions={line.positions} color={line.id === selectedRouteId ? "var(--primary)" : "var(--primary-border)"} showArrows={line.id === selectedRouteId} />)}{buses.filter((bus) => bus.status === "active" && bus.position && (selectedRoute === "All routes" || bus.routeId === selectedRoute)).map((bus) => <BusMarker key={bus.id} position={bus.position} bus={bus} selected={bus.id === selectedBus?.id} stale={isStale(bus, now)} onSelect={selectBus} />)}{visibleStops.map((stop) => <StopMarker key={`${stop.routeId}-${stop.routeStopId || stop.id}`} position={stop.position} stop={stop} next={String(stop.id) === String(selectedBus?.nextStopId)} selected={String(stop.id) === String(selectedStop?.id)} onSelect={(stop) => { setSelectedStop(stop); setSelectedBusId(null); setFollowBus(false); }} />)}<UserLocationMarker location={userLocation} /><MapControls onLocate={locateUser} onShowAll={showAllBuses} onToggleFollow={selectedBus ? () => setFollowBus((value) => !value) : null} followActive={followBus} followDisabled={!selectedBus || isStale(selectedBus, now)} /></ClientTransitMap><LiveMapLegend showUser={Boolean(userLocation)} /></div>{dataLoading && !buses.length && <div className="pointer-events-none absolute left-4 top-4 z-[450] rounded-xl bg-[var(--card)] px-4 py-2 text-sm shadow-sm" role="status">Loading transit information...</div>}{tileError && <div className="absolute inset-x-4 top-4 z-[500] rounded-xl bg-[var(--card)] p-3 text-sm shadow-lg">Unable to load all map tiles. <button type="button" className="font-semibold text-[var(--primary-ink)] underline" onClick={() => setTileError(false)}>Try again</button></div>}{selectedBus && <div className="map-live-sheet absolute bottom-4 left-4 right-4 z-[500] sm:max-w-sm" role="region" aria-label={`Bus details for ${selectedBus.number || selectedBus.busNumber || "selected bus"}`}><BusDetailsPanel bus={selectedBus} stops={selectedStops} stale={isStale(selectedBus, now)} followActive={followBus} onToggleFollow={() => setFollowBus((value) => !value)} onClose={() => { setSelectedBusId(null); setFollowBus(false); }} /></div>}{selectedStop && <div className="map-live-sheet absolute bottom-4 left-4 right-4 z-[500] sm:max-w-sm" role="region" aria-label={`Stop details for ${selectedStop.name || selectedStop.stopName || "selected stop"}`}><StopDetailsPanel stop={selectedStop} onClose={() => setSelectedStop(null)} /></div>}</div>
      <aside className="min-w-0"><Card visual="fleet" treatment="primary" className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Network now</p><h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">Fleet</h2></div><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]"><Wifi size={14} /> {connection === "live" ? "Updates on" : connection === "offline" ? "Offline" : "Connecting"}</span></div><p className="mt-1 text-sm text-[var(--muted)]">{filteredBuses.length} of {buses.length} buses shown</p></Card><div className="fleet-bus-list mt-3 grid gap-3 xl:max-h-[432px] xl:overflow-y-auto xl:pr-1">{dataLoading && !buses.length ? <SectionSkeleton label="Loading buses" count={3} /> : dataError && !buses.length ? <EmptyState title="Transit data unavailable" description="Unable to load transit information." action={<Button type="button" variant="secondary" onClick={loadData}>Retry</Button>} /> : filteredBuses.length ? filteredBuses.map((bus) => <BusCard key={bus.id} bus={{ ...bus, isSaved: isStale(bus, now) }} selected={bus.id === selectedBus?.id} onSelect={() => selectBus(bus)} />) : <EmptyState title="No buses found" description="There are no buses matching your filters." action={<Button type="button" variant="secondary" onClick={() => { setSearchTerm(""); setSelectedRoute("All routes"); setSelectedStatus("All"); }}>Clear filters</Button>} />}</div></aside></section>
    {selectedRouteId && !routeLines.length && <Card className="mt-4 p-4 text-sm text-[var(--muted)]">Road geometry for this route is still being prepared. Stops remain visible, but no substitute line is shown.</Card>}
    <section className="mt-7"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Network guide</p><h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">Stops &amp; Popular Routes</h2></div><div className="grid gap-4 md:grid-cols-3"><Card treatment="stat" className="flex min-h-[158px] items-center p-5"><div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]"><MapPinned size={18} /></span><p className="mt-4 text-2xl font-bold text-[var(--foreground)]">{visibleStops.length}</p><p className="text-sm font-semibold text-[var(--foreground)]">Stops visible</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Tap a stop for route information.</p></div></Card>{routeCards.map((route) => <RouteCard key={route.id} route={route} />)}</div></section></main><Footer /></div>;
}

function Notice({ icon, text }) { return <div className="mt-6 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">{icon}{text}</div>; }
