"use client";


import Link from "../common/SmartLink";
import { useEffect, useState } from "react";
import { BusFront, ArrowLeft, ArrowRight, Clock3, MapPin, RefreshCw, Route as RouteIcon, Users, X } from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { ErrorState } from "../common/ErrorState";
import { BusDetailsSkeleton } from "./BusDetailsSkeleton";
import { ClientTransitMap } from "../map/MapShell";
import { BusMarker } from "../map/MapShell";
import { StopMarker } from "../map/MapShell";
import { RoutePolyline } from "../map/MapShell";
import { MapControls } from "../map/MapShell";
import { MapViewport } from "../map/MapShell";
import { useLiveBuses } from "../../hooks/useLiveBuses";
import { useSocket } from "../../hooks/useSocket";
import { getBusDirection, getDirectionLabel, getStopsInDirection } from "../../lib/transit/direction";

import { useTransitQuery, useLiveConnection } from "../../hooks/useTransitQuery";
import { transitQueries } from "../../lib/query/transitQueries";
import { CacheStatus, useOnline } from "../common/CacheStatus";

function getPosition(bus) {
  if (bus.currentLocation?.latitude != null && bus.currentLocation?.longitude != null) return [bus.currentLocation.latitude, bus.currentLocation.longitude];
  if (bus.latitude != null && bus.longitude != null) return [bus.latitude, bus.longitude];
  return null;
}

function getEtaLabel(minutes) {
  if (minutes == null) return null;
  if (minutes <= 1) return "Arriving";
  return `${Math.round(minutes)} min`;
}

function getOccupancy(bus) {
  if (bus.occupancy) return bus.occupancy;
  return null;
}

function mergeUpdate(bus, update) {
  if (!update) return bus;
  const currentLocation = update.latitude != null ? { latitude: update.latitude, longitude: update.longitude } : bus.currentLocation;
  return {
    ...bus,
    ...update,
    busNumber: bus.busNumber,
    currentLocation,
    position: getPosition({ ...bus, ...update, currentLocation }),
    eta: update.etaMinutes != null ? getEtaLabel(update.etaMinutes) : bus.eta,
    nextStop: update.nextStop?.stopName || update.nextStop || bus.nextStop,
    nextStopId: update.nextStop?._id || bus.nextStopId,
    distanceKm: update.distanceKm ?? bus.distanceKm,
    lastLocationUpdate: update.lastLocationUpdate || bus.lastLocationUpdate,
  };
}

export default function BusDetailsPage({ busId }) {
  const socket = useSocket();
  const liveUpdates = useLiveBuses([]);
  const busQuery = useTransitQuery({ ...transitQueries.bus(busId), refetchOnMount: "always" });
  const metadataQuery = useTransitQuery(transitQueries.busMetadata(busId), false);
  const busData = busQuery.data || metadataQuery.data;
  const referenceId = busData?.route?._id || busData?.route;
  const routeQuery = useTransitQuery(transitQueries.route(referenceId), Boolean(referenceId));
  const stopsQuery = useTransitQuery(transitQueries.stops(referenceId), Boolean(referenceId));
  const etaQuery = useTransitQuery(transitQueries.eta(busId));
  const online = useOnline();
  const connected = useLiveConnection();
  const eta = online && !etaQuery.isError && !etaQuery.isStale ? etaQuery.data : null;
  const bus = busData ? { ...busData, position: getPosition(busData), eta: getEtaLabel(eta?.etaMinutes), nextStop: eta?.nextStop?.stopName, nextStopId: eta?.nextStop?._id, distanceKm: eta?.distanceKm } : null;
  const route = routeQuery.data;
  const storedStops = stopsQuery.data || [];
  const loading = busQuery.loading;
  const error = busQuery.error?.response?.status === 404 ? "not-found" : !bus && busQuery.isError ? "error" : null;
  const [socketConnected, setSocketConnected] = useState(false);
  const loadBus = () => { busQuery.refetch(); etaQuery.refetch(); routeQuery.refetch(); stopsQuery.refetch(); };

  useEffect(() => {
    if (busId) socket.emit("watchBus", busId);
  }, [busId, socket]);

  useEffect(() => {
    const handleConnect = () => { socket.emit("watchBus", busId); setSocketConnected(true); };
    if (socket.connected) handleConnect();
    const handleDisconnect = () => setSocketConnected(false);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket, busId]);

  const liveBus = (() => {
    if (!bus) return null;
    const update = liveUpdates.find((item) => (item.id || item._id || item.busId)?.toString() === busId.toString());
    const current = mergeUpdate(bus, update);
    return !online || !connected || busQuery.isError || busQuery.isStale ? { ...current, availableSeats: null, occupancy: null, eta: null, nextStop: null, position: null } : current;
  })();

  const direction = getBusDirection(liveBus);
  const stops = getStopsInDirection(storedStops, direction);
  const stopPositions = stops.filter((stop) => stop.latitude != null && stop.longitude != null).map((stop) => [stop.latitude, stop.longitude]);
  const busPosition = liveBus?.position;
  const road = route?.geometry?.[direction === "return" ? "return" : "outbound"] || [];
  const mapPositions = busPosition ? [...road, busPosition] : road;
  const directionLabel = getDirectionLabel(route, direction);
  const nextStopId = (liveBus?.nextStopId || eta?.nextStop?._id)?.toString();
  const routeId = liveBus?.route?._id || liveBus?.route || route?._id;
  const routeName = route?.routeName || liveBus?.route?.routeName || "Transit route";
  const routeLabel = route?.routeCode || route?.number || "Route";
  const occupancy = getOccupancy(liveBus || {});
  const lastUpdated = liveBus?.lastLocationUpdate ? new Date(liveBus.lastLocationUpdate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  const operating = liveBus?.status === "active";

  if (loading && !bus) return <div className="min-h-screen bg-[var(--background)]"><Navbar /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><BusDetailsSkeleton /></main><Footer /></div>;
  if (error === "not-found") return <NotFoundState />;
  if (error || !liveBus) return <ErrorStatePage onRetry={loadBus} />;

  return <div className="min-h-screen overflow-x-hidden bg-[var(--background)]"><Navbar /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div className="relative mb-6 flex min-h-44 items-end rounded-2xl border border-[var(--border)] bg-white p-5 sm:min-h-56 sm:p-7">
      <div className="flex min-w-0 items-end gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]" aria-hidden="true"><BusFront size={22} strokeWidth={2.25} /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--primary-ink)]">{routeLabel} - {routeName}</p><h1 className="mt-1 break-words text-3xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-4xl">{liveBus.busNumber}</h1><div className="mt-2"><Badge tone={operating ? "success" : "neutral"}>{operating ? "Currently operating" : "Not operating"}</Badge></div></div></div>
      <Link href="/live-map" aria-label="Back to live buses" className="absolute right-4 top-4 inline-grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--primary-ink)] hover:border-[var(--primary)]"><ArrowLeft size={17} /></Link>
    </div>
    <CacheStatus query={busQuery.data ? busQuery : metadataQuery} /><header className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div /><Link href={routeId ? `/routes/${routeId}` : "/routes"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)] hover:text-[var(--primary-ink)]"><RouteIcon size={16} /> View full route</Link></header>

      {operating ? <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatusCard label="Current status" value="Currently operating" icon={BusFront} /><StatusCard label="Direction" value={directionLabel} icon={RouteIcon} /><StatusCard label="ETA" value={liveBus.eta || "Unavailable"} icon={Clock3} /><StatusCard label="Next stop" value={liveBus.nextStop || "Unavailable"} icon={MapPin} /><StatusCard label="Seat availability" value={occupancy || (liveBus.availableSeats != null ? liveBus.availableSeats + " available" : "Unavailable")} icon={Users} /></section> : <Card className="mt-6 p-5"><p className="font-bold">{busData?.isOfflineCache ? "Saved bus information" : "This bus is not currently operating."}</p><p className="mt-1 text-sm text-[var(--muted)]">Live location, arrival and seat information require a current connection and an active shift.</p></Card>}

      {operating && (<section className="relative mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1 shadow-[0_14px_36px_rgba(15,23,42,0.08)]"><ClientTransitMap center={busPosition || stopPositions[0] || [31.4187, 73.0791]} zoom={14} className="h-[min(64vh,590px)] min-h-[420px] rounded-xl"><MapViewport positions={mapPositions.length ? mapPositions : [[31.4187, 73.0791]]} focusKey={`${busId}-${stops.length}`} /><RoutePolyline positions={road} color="var(--primary-dark)" />{stops.filter((stop) => stop.latitude != null && stop.longitude != null).map((stop) => <StopMarker key={stop._id} position={[stop.latitude, stop.longitude]} stop={stop} />)}{busPosition && <BusMarker position={busPosition} bus={liveBus} /> }<MapControls onShowAll={(map) => mapPositions.length && map.fitBounds(mapPositions, { padding: [32, 32], maxZoom: 15 })} /></ClientTransitMap><div className="pointer-events-none absolute bottom-5 left-5 z-[400] rounded-xl border border-white/70 bg-white/95 px-4 py-3 shadow-lg backdrop-blur"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${socketConnected ? "bg-[var(--success)]" : "bg-[var(--muted)]"}`} /><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Live location</p></div><p className="mt-1 text-sm font-bold text-[var(--foreground)]">{socketConnected ? (lastUpdated ? `Updated ${lastUpdated}` : "Live") : "Last update unavailable"}</p></div></section>)}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">{operating && <div className="grid gap-6"><Card className="p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]"><MapPin size={18} /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Next stop</p><h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">{liveBus.nextStop || "Not available"}</h2><div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-2"><div><p className="text-[var(--muted)]">ETA</p><p className="mt-1 font-semibold text-[var(--foreground)]">{liveBus.eta || "Unavailable"}</p></div>{liveBus.distanceKm != null && <div><p className="text-[var(--muted)]">Distance</p><p className="mt-1 font-semibold text-[var(--foreground)]">{liveBus.distanceKm} km</p></div>}</div></div></div></Card><UpcomingStops stops={stops} nextStopId={nextStopId} /></div>}<div className="grid gap-6"><Card className="p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Service information</p><h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">Current Route</h2></div><Badge tone="success">{routeLabel}</Badge></div><h3 className="mt-4 font-semibold text-[var(--foreground)]">{routeName}</h3><div className="mt-4 grid gap-2 text-sm text-[var(--muted)]"><span>{route?.startPoint || "Starting point unavailable"}</span><span className="ml-1 h-3 border-l border-dashed border-[var(--border)]" /><span>{route?.endPoint || "Destination unavailable"}</span></div>{routeId && <Link href={`/routes/${routeId}`} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary-ink)] hover:text-[var(--primary-ink)]">View full route <ArrowRight size={15} /></Link>}</Card><Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Bus details</p><h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">{liveBus.busNumber}</h2><dl className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 text-sm"><DetailRow label="Route" value={routeLabel} />{liveBus.capacity != null && <DetailRow label="Capacity" value={`${liveBus.capacity} seats`} />}{operating && liveBus.availableSeats != null && <DetailRow label="Seats available" value={liveBus.availableSeats} />}{liveBus.driver?.name && <DetailRow label="Driver" value={liveBus.driver.name} />}</dl></Card></div></div></main><Footer /></div>;
}

function StatusCard({ label, value, icon: Icon }) {
  return <Card className="p-4"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]"><Icon size={17} /></span><div className="min-w-0"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 truncate font-bold text-[var(--foreground)]">{value}</p>{label === "Seat availability" && <Link href="/booking" className="mt-2 inline-flex text-xs font-semibold text-[var(--primary-ink)] hover:text-[var(--primary-ink)]">Reserve a seat <ArrowRight size={13} /></Link>}</div></div></Card>;
}

function DetailRow({ label, value }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-[var(--muted)]">{label}</dt><dd className="text-right font-semibold text-[var(--foreground)]">{value}</dd></div>;
}

function UpcomingStops({ stops, nextStopId }) {
  const nextIndex = stops.findIndex((stop) => stop._id?.toString() === nextStopId);
  if (nextIndex < 0) return null;
  const upcoming = stops.slice(nextIndex, nextIndex + 3);
  return <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">On the way</p><h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">Upcoming Stops</h2><div className="mt-5 grid gap-3">{upcoming.map((stop, index) => <div key={stop._id} className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[var(--primary)]" : "bg-[var(--primary-border)]"}`} /><span className={index === 0 ? "font-semibold text-[var(--foreground)]" : "text-sm text-[var(--muted)]"}>{index === 0 ? "Next" : index === 1 ? "Then" : "Later"}: {stop.stopName}</span></div>)}</div></Card>;
}

function NotFoundState() {
  return <div className="min-h-screen bg-[var(--background)]"><Navbar /><main className="mx-auto grid min-h-[60vh] max-w-7xl place-items-center px-4 py-16 sm:px-6 lg:px-8"><Card className="max-w-lg p-8 text-center"><h1 className="text-2xl font-bold text-[var(--foreground)]">Bus not found</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">The bus you&apos;re looking for doesn&apos;t exist or is no longer available.</p><Link href="/live-map" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)]"><ArrowLeft size={16} /> Back to live map</Link></Card></main><Footer /></div>;
}

function ErrorStatePage({ onRetry }) {
  return <div className="min-h-screen bg-[var(--background)]"><Navbar /><main className="mx-auto grid min-h-[60vh] max-w-7xl place-items-center px-4 py-16 sm:px-6 lg:px-8"><ErrorState title="Unable to load bus" description="We couldn&apos;t retrieve this bus right now." action={<Button type="button" variant="secondary" onClick={onRetry}><RefreshCw size={16} /> Try again</Button>} /></main><Footer /></div>;
}
