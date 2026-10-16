"use client";

import Link from "../common/SmartLink";
import { SectionSkeleton } from "../common/SectionSkeleton";

import { useEffect, useState } from "react";
import { BusFront, Info, ArrowRight, Clock3, History, Route as RouteIcon, Search, Ticket } from "lucide-react";
import { useTransitQuery, useTransitQueries, useLiveConnection } from "../../hooks/useTransitQuery";
import { transitQueries } from "../../lib/query/transitQueries";
import { CacheStatus, useOnline } from "../common/CacheStatus";
import { bookingService } from "../../services/bookingService";
import { alertService } from "../../services/alertService";
import { useLiveBuses } from "../../hooks/useLiveBuses";
import { getRouteId } from "../../lib/transit/format";

const actions = [
  { href: "/live-map", label: "Live Buses", icon: BusFront },
  { href: "/routes", label: "Routes", icon: RouteIcon },
  { href: "/booking", label: "Book Ticket", icon: Ticket },
  { href: "/my-trips", label: "My Trips", icon: History },
];
function etaLabel(value) {
  if (!Number.isFinite(value?.etaMinutes) || value.etaMinutes < 0) return null;
  return value.etaMinutes <= 1 ? "Arriving" : `${Math.round(value.etaMinutes)} min`;
}

export default function CommuterHome() {
  const liveUpdates = useLiveBuses([]);
  const routesQuery = useTransitQuery(transitQueries.routes());
  const busesQuery = useTransitQuery(transitQueries.buses());
  const online = useOnline();
  const connected = useLiveConnection();
  const etaQueries = useTransitQueries((busesQuery.data || []).filter((bus) => bus.status === "active").map((bus) => transitQueries.eta(bus._id)));
  const etas = Object.fromEntries((busesQuery.data || []).filter((bus) => bus.status === "active").map((bus, index) => [bus._id, online && connected && !etaQueries[index]?.isStale && !etaQueries[index]?.isError ? etaQueries[index]?.data : null]));
  const [secondary, setData] = useState({ bookings: [], alerts: [], bookingsLoading: true, alertsLoading: true, bookingsError: false, alertsError: false });
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    bookingService.getMyBookings().then((bookings) => {
      if (active) setData((current) => ({ ...current, bookings: Array.isArray(bookings) ? bookings : bookings.bookings || [], bookingsLoading: false }));
    }).catch(() => { if (active) setData((current) => ({ ...current, bookingsLoading: false, bookingsError: true })); });
    alertService.listActive().then((alerts) => {
      if (active) setData((current) => ({ ...current, alerts, alertsLoading: false }));
    }).catch(() => { if (active) setData((current) => ({ ...current, alertsLoading: false, alertsError: true })); });
    return () => { active = false; };
  }, []);

  const data = { ...secondary, etas, routes: routesQuery.data || [], buses: busesQuery.data || [], loading: routesQuery.loading, error: busesQuery.isError };
  const buses = data.buses.map((bus) => {
    const update = liveUpdates.find((item) => String(item.id || item._id || item.busId) === String(bus._id));
    return update ? { ...bus, ...update, status: update.status || bus.status } : bus;
  });
  useEffect(() => {
    let timer;
    let active = true;
    const update = () => {
      if (!active) return;
      const current = Date.now();
      setNow(current);
      const deadlines = [...(busesQuery.data || []), ...liveUpdates].map((bus) => new Date(bus.lastLocationUpdate || 0).getTime() + 30001).filter((deadline) => Number.isFinite(deadline) && deadline > current);
      window.clearTimeout(timer);
      if (deadlines.length) timer = window.setTimeout(update, Math.min(Math.min(...deadlines) - current, 30001));
    };
    queueMicrotask(update);
    document.addEventListener("visibilitychange", update);
    return () => { active = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", update); };
  }, [busesQuery.data, liveUpdates]);

  function hasCurrentTelemetry(bus) {
    const updated = new Date(bus.lastLocationUpdate || 0).getTime();
    return online && connected && !busesQuery.isError && !busesQuery.isStale && now > 0 && updated > 0 && updated <= now && now - updated <= 30000;
  }

  const operatingBuses = buses.filter((bus) => bus.status === "active");
  const current = data.bookings.find((booking) => booking.status === "confirmed");
  const routeMap = Object.fromEntries(data.routes.map((route) => [getRouteId(route), route]));

  return <main className="commuter-home"><CacheStatus query={routesQuery} />
    <section className="commuter-intro premium-card premium-card--primary p-5 sm:p-7"><p>Your Faisalabad journey</p><h1>Where are you going?</h1><span>Find a route, follow an active bus, or manage your next trip.</span></section>
    <Link href="/routes" className="commuter-search"><Search size={20} /><span>Search routes and destinations</span><ArrowRight size={18} /></Link>

    <section className="commuter-panel commuter-actions"><div className="commuter-section-heading"><h2>Quick actions</h2></div><div className="commuter-quick">{actions.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="premium-card premium-card--glass"><span className="commuter-action-icon"><Icon size={21} /></span><span>{label}</span><ArrowRight size={15} /></Link>)}</div></section>

    <div className="commuter-dashboard-grid">
      <section className="commuter-panel premium-card premium-card--operational p-4 sm:p-5"><div className="commuter-section-heading"><h2>Live buses</h2><Link href="/live-map">View all <ArrowRight size={14} /></Link></div>{busesQuery.loading ? <SectionSkeleton label="Loading active buses" variant="rows" count={1} /> : data.error && !data.buses.length ? <p className="commuter-muted">Transit information is unavailable right now.</p> : operatingBuses.length ? <div className="commuter-bus-list">{operatingBuses.slice(0, 3).map((bus) => { const route = typeof bus.route === "object" ? bus.route : routeMap[bus.route]; const fresh = hasCurrentTelemetry(bus); const eta = fresh ? data.etas[bus._id] : null; const direction = route?.startPoint && route?.endPoint ? `${route.startPoint} → ${route.endPoint}` : route?.routeName || "Route information unavailable"; return <Link key={bus._id} href={`/buses/${bus._id}`}><span className="commuter-bus-icon"><BusFront size={19} /></span><span><strong>{bus.busNumber}</strong><small>{route?.routeName || "Route information unavailable"}</small><small>{direction}</small></span><span className="commuter-bus-meta"><span className={fresh ? "commuter-status is-current" : "commuter-status"}>{fresh ? "Active" : "Last known"}</span>{etaLabel(eta) && <span className="commuter-bus-eta"><Clock3 size={13} /> {etaLabel(eta)}</span>}</span></Link>; })}</div> : <p className="commuter-muted">{online ? "No buses are currently operating." : "Connect to check current bus service."}</p>}</section>

      <section className="commuter-panel premium-card premium-card--operational p-4 sm:p-5"><div className="commuter-section-heading"><h2>Available routes</h2><Link href="/routes">View all <ArrowRight size={14} /></Link></div>{data.loading ? <SectionSkeleton label="Loading routes" variant="rows" count={1} /> : data.routes.length ? <div className="commuter-route-list">{data.routes.slice(0, 3).map((route) => <Link key={getRouteId(route)} href={`/routes/${getRouteId(route)}`}><span className="commuter-route-icon"><RouteIcon size={18} /></span><span><strong>{route.routeName}</strong><small>{route.startPoint} → {route.endPoint}</small></span><ArrowRight size={16} /></Link>)}</div> : <p className="commuter-muted">{routesQuery.isError ? "Routes are unavailable right now." : "No routes are currently available."}</p>}</section>

      <section className="commuter-panel premium-card premium-card--operational p-4 sm:p-5"><div className="commuter-section-heading"><h2>Active trip</h2><Link href="/my-trips">My trips</Link></div>{data.bookingsLoading ? <SectionSkeleton label="Loading your trip" variant="rows" count={1} /> : data.bookingsError ? <p className="commuter-muted">Your trip could not be loaded. Check My trips for details.</p> : current ? <Link href={`/booking/${current._id}/confirmation`} className="commuter-trip"><span className="commuter-trip-icon"><Ticket size={19} /></span><span><strong>{current.route?.routeName || "Booked route"}</strong><span className="commuter-status is-current">Confirmed</span><small>{current.bus?.busNumber || "Bus assignment pending"}{current.seatNumber ? ` · Seat ${current.seatNumber}` : ""}</small></span><ArrowRight size={18} /></Link> : <div className="commuter-empty-action"><div><strong>No active trip</strong><p>Book a seat when you are ready to travel.</p></div><Link href="/booking">Book a Ticket</Link></div>}</section>

      <section className="commuter-panel premium-card premium-card--operational p-4 sm:p-5"><div className="commuter-section-heading"><h2>Alerts</h2></div>{data.alertsLoading ? <SectionSkeleton label="Loading alerts" variant="rows" count={1} /> : data.alertsError ? <p className="commuter-muted">Alerts are unavailable right now.</p> : data.alerts.length ? <div className="commuter-alert-list">{data.alerts.slice(0, 3).map((alert) => <article key={alert._id}><Info size={17} aria-hidden="true" /><div><strong>{alert.routeName || alert.route?.routeName || "Route alert"}</strong><p>{alert.message}</p></div></article>)}</div> : <p className="commuter-muted">No new alerts</p>}</section>
    </div>
  </main>;
}
