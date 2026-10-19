"use client";

import Link from "../common/SmartLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { CardBackdrop } from "../common/CardBackdrop";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { SectionSkeleton } from "../common/SectionSkeleton";
import { ProtectedPage } from "../common/ProtectedPage";
import { DriverMap } from "./DriverMap";
import { DriverPassengerPanel } from "./DriverPassengerPanel";
import { DriverRouteCard } from "./DriverRouteCard";
import { DriverLocationControl } from "./DriverLocationControl";
import { DriverSeatControl } from "./DriverSeatControl";
import { useSocket } from "../../hooks/useSocket";
import { busService } from "../../services/busService";
import { bookingService } from "../../services/bookingService";
import { routeService } from "../../services/routeService";
import { stopService } from "../../services/stopService";
import { alertService } from "../../services/alertService";
import { getProfile } from "../../services/authService";
import { DriverStatusCard } from "./DriverStatusCard";
import { getBusDirection, getDirectionLabel, getStopsInDirection } from "../../lib/transit/direction";
import { hasRole, ROLES } from "../../lib/auth/permissions";
import { getAccessToken } from "../../lib/auth/token";

export default function DriverDashboardPage({ view = "overview" }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[var(--primary)]">
        <ProtectedPage driverOnly>{(user) => <DriverOperations key={user._id} user={user} view={view} />}</ProtectedPage>
      </main>
      <Footer />
    </div>
  );
}

function DriverOperations({ user, view }) {
  const socket = useSocket();
  const requestId = useRef(0);
  const passengerRequestId = useRef(0);
  const returnInFlight = useRef(false);
  const shiftInFlight = useRef(false);
  const [data, setData] = useState({ profile: user, bus: null, route: null, stops: [], eta: null, alerts: [], errors: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState(socket.connected ? "Connected" : "Connecting");
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [shiftBusy, setShiftBusy] = useState("");
  const [shiftError, setShiftError] = useState("");
  const [shiftMessage, setShiftMessage] = useState("");
  const [gpsStatus, setGpsStatus] = useState({ state: "stopped", message: "" });
  const [passengerLocations, setPassengerLocations] = useState([]);
  const [passengerLoading, setPassengerLoading] = useState(false);
  const [passengerError, setPassengerError] = useState("");
  const [seatSyncError, setSeatSyncError] = useState("");

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      // Shift status is operational state, so it must come from the server
      // rather than the session-profile cache.
      const profile = await getProfile({ force: true });
      if (!hasRole(profile, ROLES.DRIVER)) {
        if (id === requestId.current) setError("Your account no longer has driver access. Sign out and sign in again.");
        return;
      }
      const busId = profile.assignedBus?._id || profile.assignedBus;
      if (!busId) {
        if (id === requestId.current) setData({ profile, bus: null, route: null, stops: [], eta: null, alerts: [], errors: {} });
        return profile;
      }
      const bus = await busService.get(busId);
      const routeId = bus.route?._id || bus.route;
      const keys = ["route", "stops", "eta", "alerts"];
      const results = await Promise.allSettled([
        routeId ? routeService.get(routeId) : Promise.resolve(null),
        routeId ? stopService.listByRoute(routeId) : Promise.resolve([]),
        busService.getEta(busId),
        routeId ? alertService.listByRoute(routeId) : Promise.resolve([]),
      ]);
      if (id !== requestId.current) return;
      const next = { profile, bus, errors: {} };
      results.forEach((result, index) => {
        const key = keys[index];
        next[key] = result.status === "fulfilled" ? result.value : ["stops", "alerts"].includes(key) ? [] : null;
        if (result.status === "rejected") next.errors[key] = true;
      });
      setData(next);
      return profile;
    } catch (requestError) {
      if (id === requestId.current) setError(requestError.response?.status === 404 ? "Your assigned bus is no longer available. Contact the transit team or try refreshing." : "Unable to load your assigned bus. Check your connection and try again.");
      return null;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) load(); });
    return () => { active = false; requestId.current += 1; };
  }, [load]);

  const busId = data.bus?._id;
  const activeShift = data.profile.activeShift?.status === "active" ? data.profile.activeShift : null;
  const shiftActive = Boolean(activeShift);
  const trackingView = view === "tracking";

  const loadPassengerLocations = useCallback(async () => {
    if (!shiftActive || !busId) return;
    const id = ++passengerRequestId.current;
    setPassengerLoading(true);
    setPassengerError("");
    try {
      const response = await bookingService.getAssignedPassengerLocations();
      if (id !== passengerRequestId.current) return;
      const locations = Array.isArray(response) ? response : response.locations || [];
      setPassengerLocations(locations);
    } catch (requestError) {
      if (id !== passengerRequestId.current) return;
      const message =
        requestError.response?.data?.message ||
        "Unable to load passenger pickup locations. Check your connection and try again.";
      setPassengerError(message);
    } finally {
      if (id === passengerRequestId.current) setPassengerLoading(false);
    }
  }, [busId, shiftActive]);

  useEffect(() => {
    if (!trackingView || !shiftActive || !busId) {
      passengerRequestId.current += 1;
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setPassengerLocations([]);
        setPassengerError("");
        setPassengerLoading(false);
      });
      return () => {
        active = false;
      };
    }

    let active = true;
    Promise.resolve().then(() => {
      if (active) loadPassengerLocations();
    });

    const watch = () => {
      const token = getAccessToken();
      if (!token) {
        setPassengerError("Your session token is unavailable. Sign in again.");
        return;
      }
      socket.emit("watchDriverBookings", { token }, (result) => {
        if (!active) return;
        if (!result?.ok) {
          setPassengerError(result?.message || "Unable to watch passenger pickup updates.");
          return;
        }
        loadPassengerLocations();
      });
    };
    const update = (event) => {
      if (!event?.bookingId) return;
      if (!event.sharing) {
        setPassengerLocations((current) =>
          current.filter((item) => String(item.bookingId) !== String(event.bookingId)),
        );
        return;
      }
      if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) return;
      const next = {
        bookingId: event.bookingId,
        passenger: event.passenger,
        pickupLocation: {
          latitude: event.latitude,
          longitude: event.longitude,
          accuracy: event.accuracy,
          timestamp: event.timestamp,
        },
      };
      setPassengerLocations((current) => {
        const exists = current.some(
          (item) => String(item.bookingId) === String(event.bookingId),
        );
        return exists
          ? current.map((item) =>
              String(item.bookingId) === String(event.bookingId) ? next : item,
            )
          : [next, ...current];
      });
    };
    const accessEnded = () => {
      passengerRequestId.current += 1;
      setPassengerLocations([]);
      setPassengerError("");
    };

    socket.on("passengerLocationUpdate", update);
    socket.on("passengerLocationAccessEnded", accessEnded);
    socket.on("connect", watch);
    if (socket.connected) watch();

    return () => {
      active = false;
      passengerRequestId.current += 1;
      socket.off("passengerLocationUpdate", update);
      socket.off("passengerLocationAccessEnded", accessEnded);
      socket.off("connect", watch);
      socket.emit("unwatchDriverBookings");
    };
  }, [socket, busId, shiftActive, trackingView, loadPassengerLocations]);

  useEffect(() => {
    let active = true;
    let seatRevision = 0;
    const watch = () => {
      if (busId) socket.emit("watchBus", busId);
    };
    const refreshSeats = async () => {
      if (!busId) return;
      const revision = seatRevision;
      try {
        const updated = await busService.get(busId);
        if (!active || revision !== seatRevision) return;
        setSeatSyncError("");
        setData((current) => String(current.bus?._id) === String(busId) ? { ...current, bus: { ...current.bus, availableSeats: updated.availableSeats, capacity: updated.capacity, seatMap: updated.seatMap } } : current);
      } catch {
        if (active) setSeatSyncError("Seat availability could not be refreshed. Use Refresh dashboard to get the latest seats.");
      }
    };
    const connected = () => { setConnection("Connected"); watch(); refreshSeats(); };
    const disconnected = () => setConnection("Disconnected");
    const failed = () => setConnection("Reconnecting");
    const update = (location) => {
      if (String(location.busId) !== String(busId)) return;
      if (location.status === "idle") {
        setGpsStatus({ state: "stopped", message: "" });
        setPassengerLocations([]);
      }
      setData((current) => {
        if (String(current.bus?._id) !== String(location.busId)) return current;
        const hasCoordinates = location.latitude != null && location.longitude != null;
        const hasEta = Object.hasOwn(location, "currentStop") || Object.hasOwn(location, "nextStop") || Object.hasOwn(location, "etaMinutes");
        return {
          ...current,
          profile: location.status === "idle" ? { ...current.profile, activeShift: null } : current.profile,
          bus: {
            ...current.bus,
            ...(hasCoordinates ? { currentLocation: { latitude: location.latitude, longitude: location.longitude } } : {}),
            ...(location.lastLocationUpdate ? { lastLocationUpdate: location.lastLocationUpdate } : {}),
            status: location.status || current.bus.status,
            direction: location.direction || current.bus.direction,
          },
          eta: hasEta ? { ...current.eta, direction: location.direction, currentStop: location.currentStop, nextStop: location.nextStop, etaMinutes: location.etaMinutes, distanceKm: location.distanceKm, terminalReached: location.terminalReached } : current.eta,
          errors: { ...current.errors, eta: false },
        };
      });
    };
    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", failed);
    socket.on("locationUpdate", update);
    const seatsChanged = (payload) => {
      if (String(payload.busId) !== String(busId)) return;
      seatRevision += 1;
      setSeatSyncError("");
      setData((current) => String(current.bus?._id) === String(busId) ? { ...current, bus: { ...current.bus, availableSeats: payload.availableSeats, seatMap: payload.seatMap, capacity: payload.capacity ?? current.bus.capacity } } : current);
    };
    socket.on("seatMapUpdate", seatsChanged);
    if (socket.connected) watch();
    return () => {
      active = false;
      socket.off("connect", connected);
      socket.off("disconnect", disconnected);
      socket.off("connect_error", failed);
      socket.off("locationUpdate", update);
      socket.off("seatMapUpdate", seatsChanged);
    };
  }, [socket, busId]);

  const locationUpdated = useCallback((updated) => {
    setData((current) => {
      if (current.bus?._id !== updated._id) return current;
      return {
        ...current,
        bus: { ...current.bus, ...updated },
        eta: { direction: updated.direction, currentStop: updated.currentStop, nextStop: updated.nextStop, etaMinutes: updated.etaMinutes, distanceKm: updated.distanceKm, terminalReached: updated.terminalReached },
        errors: { ...current.errors, eta: false },
      };
    });
  }, []);

  const locationStatusChanged = useCallback((state, message) => {
    setGpsStatus({ state, message });
  }, []);

  const startShift = useCallback(async () => {
    if (shiftInFlight.current) return;
    shiftInFlight.current = true;
    setShiftBusy("starting");
    setShiftError("");
    setShiftMessage("");
    try {
      const result = await busService.startShift();
      setShiftMessage("Shift started.");
      setGpsStatus({ state: "starting", message: "" });
      setData((current) => ({
        ...current,
        profile: { ...current.profile, activeShift: result.shift },
        bus: { ...current.bus, ...result.shift.bus },
        route: current.route || result.shift.route,
      }));
      await load();
    } catch (requestError) {
      setShiftError(getShiftRequestError(requestError, "start"));
      if (requestError.response?.status === 409) await load();
    } finally {
      shiftInFlight.current = false;
      setShiftBusy("");
    }
  }, [load]);

  const endShift = useCallback(async () => {
    if (shiftInFlight.current) return;
    shiftInFlight.current = true;
    setShiftBusy("ending");
    setShiftError("");
    setShiftMessage("");
    try {
      const result = await busService.endShift();
      setShiftMessage("Shift ended.");
      setData((current) => ({
        ...current,
        profile: { ...current.profile, activeShift: null },
        bus: { ...current.bus, ...result.shift.bus },
      }));
      setGpsStatus({ state: "stopped", message: "" });
      setPassengerLocations([]);
      await load();
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        const profile = await load();
        if (profile && profile.activeShift?.status !== "active") {
          setData((current) => ({ ...current, profile: { ...current.profile, ...profile, activeShift: null } }));
          setGpsStatus({ state: "stopped", message: "" });
          setPassengerLocations([]);
          setShiftError("Your shift is no longer active.");
          return;
        }
      }
      setShiftError(getShiftRequestError(requestError, "end"));
    } finally {
      shiftInFlight.current = false;
      setShiftBusy("");
    }
  }, [load]);

  const startReturnTrip = useCallback(async () => {
    if (returnInFlight.current) return;
    returnInFlight.current = true;
    setReturnBusy(true);
    setReturnError("");
    try {
      const updated = await busService.startReturnTrip();
      setData((current) => ({
        ...current,
        bus: current.bus?._id === updated._id ? { ...current.bus, ...updated } : current.bus,
        eta: { direction: updated.direction, currentStop: updated.currentStop, nextStop: updated.nextStop, etaMinutes: updated.etaMinutes, distanceKm: updated.distanceKm, terminalReached: updated.terminalReached },
        errors: { ...current.errors, eta: false },
      }));
    } catch (requestError) {
      setReturnError(requestError.response?.data?.message || "Unable to start the return trip. Try again.");
    } finally {
      returnInFlight.current = false;
      setReturnBusy(false);
    }
  }, []);
  const seatsUpdated = useCallback((updated) => {
    setData((current) => {
      if (current.bus?._id !== updated._id) return current;
      return { ...current, bus: { ...current.bus, availableSeats: updated.availableSeats, seatMap: updated.seatMap } };
    });
  }, []);

  const { profile, bus, route, stops, eta, errors } = data;

  const hasRouteAssignment = Boolean(bus?.route?._id || bus?.route);
  const direction = getBusDirection(bus);
  const directionalStops = getStopsInDirection(stops, direction);
  const directionLabel = getDirectionLabel(route, direction);
  const nextStopId = eta?.nextStop?._id;
  const retry = <Button type="button" variant="secondary" className="min-h-12 gap-2" onClick={load} disabled={loading}><RefreshCw size={16} />{loading ? "Refreshing..." : "Refresh dashboard"}</Button>;
  const viewTitle = {
    overview: "Driver Dashboard",
    shift: "Shift",
    route: "Route",
    tracking: "Live Tracking",
    seats: "Seats",
  }[view] || "Driver Dashboard";

  return (
    <>
      <header className={`premium-driver-header premium-card premium-card--primary ${view === "seats" ? "" : "premium-card--imagery"} flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6`}>{view !== "seats" && <CardBackdrop visual={view === "shift" ? "shift" : "driver"} priority />}
        <div className="relative z-10 min-w-0"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--primary-ink)]">Driver operations</p><h1 className="mt-1 text-2xl font-bold">{viewTitle}</h1><p className="mt-1 break-words text-sm text-[var(--muted)]">{profile.name}</p></div>
        <div className="relative z-10">{retry}</div>
      </header>
      {bus && !error && (view === "shift" || view === "overview") && <DriverStatusCard bus={bus} route={route} eta={eta} errors={errors} direction={direction} directionLabel={directionLabel} shiftActive={shiftActive} shiftBusy={shiftBusy} shiftError={shiftError} shiftMessage={shiftMessage} hasRouteAssignment={hasRouteAssignment} gpsStatus={gpsStatus} onShift={shiftActive ? endShift : startShift} returnBusy={returnBusy} returnError={returnError} onReturn={startReturnTrip} />}
      {loading && !bus ? <SectionSkeleton className="mt-6" variant={view === "tracking" ? "map" : "cards"} label="Loading assigned bus and shift information" /> : error ? <div className="mt-6"><ErrorState title="Driver information unavailable" description={error} action={retry} /></div> : !bus ? <div className="mt-6"><EmptyState title="No Bus Assigned" description="Please contact the administrator to get a bus assigned before starting a shift." /></div> : (
        <>
          {view === "overview" && <><section className="driver-overview-actions mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Driver tools">
            <Link href="/driver/shift"><strong>Shift</strong><span>Start or end your shift</span></Link>
            <Link href="/driver/route"><strong>Route</strong><span>View assigned stops</span></Link>
            <Link href="/driver/tracking"><strong>Live tracking</strong><span>Share location and view map</span></Link>
            <Link href="/driver/seats"><strong>Seats</strong><span>Manage individual seats</span></Link>
          </section></>}
          {view === "shift" && <section className="driver-section-note mt-4">{!shiftActive && <p>Start your shift, then open tracking.</p>}<Link href="/driver/tracking">Open live tracking</Link></section>}
          {view === "route" && <div className="driver-detail-grid mt-4"><DriverRouteCard route={route} stops={directionalStops} nextStopId={nextStopId} errors={errors} /></div>}
          {view === "tracking" && <><DriverStatusCard bus={bus} route={route} eta={eta} direction={direction} directionLabel={directionLabel} shiftActive={shiftActive} gpsStatus={gpsStatus} errors={errors} /><div className="driver-main-grid mt-4 grid items-start gap-4 md:grid-cols-2"><div className="grid gap-4"><DriverMap bus={bus} stops={directionalStops} nextStopId={nextStopId} connection={connection} passengers={passengerLocations} /><Card treatment="operational" className="p-4"><h2 className="font-bold">GPS sharing</h2><DriverLocationControl key={`location-${bus._id}-${activeShift?._id || "inactive"}`} bus={bus} enabled={shiftActive} onUpdate={locationUpdated} onStatusChange={locationStatusChanged} /></Card></div><DriverPassengerPanel active={shiftActive} passengers={passengerLocations} loading={passengerLoading} error={passengerError} onRetry={loadPassengerLocations} /></div></>}
          {view === "seats" && <Card treatment="operational" className="mt-4 min-w-0 p-5"><h2 className="font-bold">Seats</h2>{seatSyncError && <p role="status" className="mt-3 text-sm text-[var(--warning)]">{seatSyncError}</p>}<DriverSeatControl key={`seats-${bus._id}`} bus={bus} onUpdate={seatsUpdated} shiftActive={shiftActive} /></Card>}
        </>
      )}
    </>
  );
}

function SectionError({ label }) {
  return <p role="alert" className="mt-3 text-sm text-[var(--danger)]">Unable to load {label}. Use Refresh dashboard to try again.</p>;
}

function getShiftRequestError(error, action) {
  if (!error.response) return `Unable to ${action} the shift. Check your connection and try again.`;
  if (error.response.status === 401) return "Your session has expired. Sign in again.";
  if (error.response.status === 403) return "Your account is not authorized to manage driver shifts.";
  if (error.response.status === 404) return "Your assigned bus could not be found. Refresh the dashboard or contact the administrator.";
  if (error.response.status === 409) return action === "start" ? "A shift is already active for this driver or bus." : "No active shift was found.";
  return `Unable to ${action} the shift. Please try again.`;
}
