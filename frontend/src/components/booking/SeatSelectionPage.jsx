"use client";


import Link from "../common/SmartLink";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BusFront, ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  LocateFixed,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
  WalletCards,
  X, } from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { ErrorState } from "../common/ErrorState";
import { ClientTransitMap } from "../map/MapShell";
import { MapViewport } from "../map/MapShell";
import { StopMarker } from "../map/MapShell";
import { BookingProgress } from "./BookingProgress";
import { busService } from "../../services/busService";
import { routeService } from "../../services/routeService";
import { bookingService } from "../../services/bookingService";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../lib/auth/token";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useSocket } from "../../hooks/useSocket";
import { readCachedBusDetails, saveCachedBusDetails } from "../../lib/live-map/liveMapStorage";
import { savePendingBooking } from "../../lib/offline/bookingQueue";

function getId(value) {
  return value?._id || value || "";
}

function getLocationMessage(error) {
  if (!error) return "";
  if (error.code === 1) {
    return "Location permission was denied. You can still complete the booking without sharing it.";
  }
  if (error.code === 3) {
    return "Finding your location timed out. Try again, or continue without sharing it.";
  }
  return "Your current location could not be determined. You can still complete the booking.";
}

export default function SeatSelectionPage({
  busId,
  routeId,
  bookingMode = "route",
}) {
  const router = useRouter();
  const socket = useSocket();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [bus, setBus] = useState(null);
  const [route, setRoute] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState("");
  const [pickupLocation, setPickupLocation] = useState(null);
  const [locationRequest, setLocationRequest] = useState(0);
  const [locationNotice, setLocationNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [seatNotice, setSeatNotice] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  const geolocationOptions = useMemo(
    () => ({ enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }),
    [],
  );
  const geolocation = useGeolocation(geolocationOptions, {
    enabled: locationRequest > 0,
    oneShot: true,
    refreshKey: locationRequest,
  });

  const loadBus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const busData = await busService.get(busId);
      const selectedRouteId = routeId || getId(busData.route);
      setBus(busData);
      const routeData = selectedRouteId ? await routeService.get(selectedRouteId) : null;
      setRoute(routeData);
      saveCachedBusDetails(busId, { bus: busData, route: routeData });
    } catch (requestError) {
      const cached = await readCachedBusDetails(busId);
      if (cached?.bus) {
        setBus(cached.bus);
        setRoute(cached.route || null);
        setError("offline");
      } else if (requestError.response?.status === 404) setError("not-found");
      else {
        console.error("Unable to load seat selection data", requestError);
        setError("load-error");
      }
    } finally {
      setLoading(false);
    }
  }, [busId, routeId]);

  useEffect(() => {
    Promise.resolve().then(() => loadBus());
  }, [loadBus]);

  useEffect(() => {
    const position = geolocation.position;
    if (!position || locationRequest === 0) return;
    const nextLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date(position.timestamp || Date.now()).toISOString(),
    };
    queueMicrotask(() => {
      setPickupLocation(nextLocation);
      setLocationNotice("Location ready to share with your assigned driver after booking.");
    });
  }, [geolocation.position, locationRequest]);

  useEffect(() => {
    if (!geolocation.error || locationRequest === 0) return;
    queueMicrotask(() => setLocationNotice(getLocationMessage(geolocation.error)));
  }, [geolocation.error, locationRequest]);

  const seats = useMemo(() => bus?.seatMap || [], [bus?.seatMap]);
  const rows = useMemo(() => [...new Set(seats.map((seat) => seat.row))].sort((a, b) => a - b), [seats]);
  const columns = Math.max(1, ...seats.map((seat) => seat.column + 1));
  const configured = seats.length > 0;
  const availableSeats = bus?.availableSeats ?? null;
  const isFull = availableSeats === 0;
  const seatAvailability = isFull ? "Full" : availableSeats == null ? "Unavailable" : "Available";
  const actualRouteId = routeId || getId(bus?.route);
  const driver = bus?.driver;
  const selectedSeatAvailable = seats.some((seat) => seat.label === selectedSeat && seat.status === "available");
  useEffect(() => {
    if (!selectedSeat || selectedSeatAvailable) return;
    queueMicrotask(() => {
      setSelectedSeat((current) => current === selectedSeat ? "" : current);
      setSeatNotice(`Seat ${selectedSeat} is no longer available. Please choose another seat.`);
    });
  }, [selectedSeat, selectedSeatAvailable]);

  useEffect(() => {
    if (!busId) return;
    let active = true;
    let seatRevision = 0;
    const watch = () => socket.emit("watchBus", busId);
    const refresh = async () => {
      const revision = seatRevision;
      try {
        const updated = await busService.get(busId);
        if (active && revision === seatRevision) setBus((current) => current ? { ...current, seatMap: updated.seatMap, availableSeats: updated.availableSeats, capacity: updated.capacity } : updated);
      } catch {
        if (active) setSeatNotice("Seat availability could not be refreshed. Check your connection and use Retry to get the latest seats.");
      }
    };
    const connected = () => { watch(); refresh(); };
    const changed = (payload) => {
      if (String(payload.busId) !== String(busId)) return;
      seatRevision += 1;
      setBus((current) => current ? { ...current, seatMap: payload.seatMap, availableSeats: payload.availableSeats, capacity: payload.capacity ?? current.capacity } : current);
    };
    socket.on("connect", connected);
    socket.on("seatMapUpdate", changed);
    if (socket.connected) watch();
    return () => { active = false; socket.off("connect", connected); socket.off("seatMapUpdate", changed); };
  }, [socket, busId]);

  function selectSeat(label) {
    setSelectedSeat(label);
    setSeatNotice("");
    setSubmitError("");
  }
  const locationPosition = pickupLocation
    ? [pickupLocation.latitude, pickupLocation.longitude]
    : null;

  function requestLocation() {
    setLocationNotice("");
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setLocationNotice(
        "Location requires HTTPS (or localhost). You can still complete the booking without it.",
      );
      return;
    }
    setLocationRequest((current) => current + 1);
  }

  async function continueToConfirmation() {
    if (isFull || (configured && (!selectedSeat || seats.find((seat) => seat.label === selectedSeat)?.status !== "available"))) return;
    if (!isAuthenticated || !getAccessToken()) {
      const target =
        `/booking/${busId}/seat?route=${encodeURIComponent(actualRouteId)}` +
        `&mode=${bookingMode}`;
      router.push(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }

    const payload = {
      routeId: actualRouteId,
      ...(configured ? { seatNumber: selectedSeat } : {}),
      bus: busId,
      paymentMethod: "cash",
      shareLocation: Boolean(pickupLocation),
      ...(pickupLocation ? { pickupLocation } : {}),
    };
    if (bookingMode === "manual") payload.driverId = getId(driver);
    if (!online) {
      const operation = await savePendingBooking(getAccessToken(), payload, {
        routeName: route?.routeName || "Saved route",
        busNumber: bus?.busNumber || "Saved bus",
        seatNumber: selectedSeat || null,
      });
      setSeatNotice(operation.status === "waiting" ? "Booking request saved on this device. It is pending confirmation and will be checked when you reconnect." : "This pending booking request is already saved.");
      setSubmitError("");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const booking = await bookingService.create(payload);
      if (!booking?._id) throw new Error("Booking response did not include an ID");
      router.push(`/booking/${booking._id}/confirmation`);
    } catch (requestError) {
      const message = requestError.response?.data?.message || requestError.message || "";
      const seatConflict =
        requestError.response?.status === 409 && /seat|available|reserved|booking/i.test(message);
      if (seatConflict) {
        setSelectedSeat("");
        setSubmitError(
          message || "This seat was just reserved by another passenger. Please choose another seat.",
        );
        loadBus();
      } else {
        setSubmitError(message || "Unable to reserve this seat. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !bus) {
    return (
      <PageShell>
        <SeatSelectionSkeleton />
      </PageShell>
    );
  }
  if (error === "not-found") {
    return (
      <PageShell>
        <StateCard title="Bus not found" description="This bus is no longer available for booking." />
      </PageShell>
    );
  }
  if ((error && error !== "offline") || !bus) {
    return (
      <PageShell>
        <ErrorState
          title="Unable to load seats"
          description="We couldn't retrieve the current seat availability."
          action={
            <Button type="button" variant="secondary" onClick={loadBus}>
              <RefreshCw size={16} /> Try again
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link
          href={actualRouteId ? `/booking?route=${actualRouteId}` : "/booking"}
          className="font-semibold text-[var(--primary-ink)] hover:text-[var(--primary-ink)]"
        >
          <ArrowLeft size={19} aria-hidden="true" /><span className="sr-only">Back to trip details</span>
        </Link>
        <span>/</span>
        <span>Seat and pickup</span>
      </div>

      <header className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">
          Step 2 of 3
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Choose your seat.
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Choose a seat and optionally share a pickup location with the assigned driver.
        </p>
      </header>

      <BookingProgress currentStep={2} />

      {error === "offline" && <p role="status" className="mt-5 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]">Offline — showing the last saved seat map. A selected seat is only a pending request until Smart Safar confirms it online.</p>}

      <Card className="mt-6 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryItem label="Route" value={route?.routeName || bus.route?.routeName || "Not available"} />
          <SummaryItem label="Bus preview" value={bus.busNumber} />
          <SummaryItem label="Assigned driver" value={driver?.name || "Not assigned"} />
        </div>
        {bookingMode === "route" && (
          <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs leading-5 text-[var(--muted)]">
            Your chosen seat belongs to this bus. We&apos;ll confirm the current driver, shift, and seat availability when you book.
          </p>
        )}
      </Card>

      <div className="booking-layout mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)] lg:items-start">
        <div className="grid min-w-0 gap-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Bus Seat Map</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Front of bus</p>
              </div>
              <Badge tone={seatAvailability === "Full" ? "danger" : "success"}>
                {availableSeats == null ? "Availability unavailable" : `${availableSeats} available`}
              </Badge>
            </div>

            {configured && <label className="mt-5 grid gap-2 text-sm font-semibold text-[var(--foreground)] sm:hidden" htmlFor="booking-seat-choice">Select a seat
              <select id="booking-seat-choice" className="field-input min-h-12 w-full min-w-0" value={selectedSeatAvailable ? selectedSeat : ""} disabled={submitting || isFull} onChange={(event) => selectSeat(event.target.value)}>
                <option value="">Choose an available seat</option>
                {seats.map((seat) => <option key={seat.label} value={seat.label} disabled={seat.status !== "available"}>Seat {seat.label} - {seat.status === "booked" ? "booked online" : seat.status === "occupied" ? "walk-in occupied" : "available"}</option>)}
              </select>
            </label>}
            {seatNotice && <p role="status" className="mt-4 text-sm text-[var(--warning)]">{seatNotice} <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => { setSeatNotice(""); loadBus(); }}>Retry</button></p>}
            {seats.length ? (
              <div className="mx-auto mt-6 max-w-sm rounded-[2rem] border-2 border-[var(--primary-border)] bg-[var(--background)] p-4">
                <div className="mb-5 rounded-xl bg-[var(--primary-soft)] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">
                  Driver / front
                </div>
                <div className="grid gap-2">
                  {rows.map((row, index) => {
                    const rowSeats = seats.filter((item) => item.row === row);
                    const section = sectionLabel(rowSeats[0]);
                    const previousSection = index ? sectionLabel(seats.filter((item) => item.row === rows[index - 1])[0]) : null;
                    return <Fragment key={row}>{section && section !== previousSection && <p className="seat-section-label">{section}</p>}<div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                      {Array.from({ length: columns }, (_, column) => {
                        const seat = rowSeats.find((item) => item.column === column);
                        return seat ? <SeatButton key={seat.label} seat={seat} selected={selectedSeat === seat.label && seat.status === "available"} disabled={submitting || isFull || seat.status !== "available"} onSelect={selectSeat} /> : <span key={column} aria-hidden="true" />;
                      })}
                    </div></Fragment>;
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-[var(--muted)]">
                This bus has no configured physical seat map. You can still book one available seat, but an exact seat number cannot be selected yet.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-4 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
              <Legend color="bg-white border-[#86efac]" label="Available" />
              <Legend color="bg-[var(--primary)] border-[var(--primary)]" label="Selected" />
              <Legend color="bg-[var(--primary-soft)] border-[var(--primary-border)]" label="Booked online" />
              <Legend color="bg-amber-100 border-amber-300" label="Walk-in occupied" />
            </div>

          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
                <MapPin size={19} />
              </span>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Passenger pickup</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Optional. Your location is shared only with the driver assigned to this booking
                  while their shift and your booking are active.
                </p>
              </div>
            </div>

            {locationPosition ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1">
                <ClientTransitMap center={locationPosition} zoom={15} className="h-64 rounded-xl">
                  <MapViewport
                    positions={[locationPosition]}
                    focusKey={`${pickupLocation.timestamp}-${locationRequest}`}
                  />
                  <StopMarker
                    position={locationPosition}
                    stop={{ name: "Your pickup location" }}
                  />
                </ClientTransitMap>
              </div>
            ) : (
              <div className="mt-5 grid min-h-32 place-items-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] p-5 text-center">
                <div>
                  <LocateFixed className="mx-auto text-[var(--primary-ink)]" size={24} />
                  <p className="mt-2 text-sm font-semibold">No pickup location selected</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Location permission is optional and never blocks booking.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant={pickupLocation ? "secondary" : "primary"}
                className="min-h-11 gap-2"
                onClick={requestLocation}
                disabled={geolocation.loading}
              >
                <LocateFixed size={16} />
                {geolocation.loading
                  ? "Finding location..."
                  : pickupLocation
                    ? "Update Location"
                    : "Use My Current Location"}
              </Button>
              {pickupLocation && (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 gap-2"
                  onClick={() => {
                    setPickupLocation(null);
                    setLocationNotice("Location removed. Your booking will not share a pickup point.");
                  }}
                >
                  <X size={16} /> Remove
                </Button>
              )}
            </div>
            {(locationNotice || (geolocation.error && !pickupLocation)) && (
              <p
                role={geolocation.error && !pickupLocation ? "alert" : "status"}
                className={`mt-3 text-sm leading-6 ${
                  geolocation.error && !pickupLocation
                    ? "text-[var(--danger)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {locationNotice || getLocationMessage(geolocation.error)}
              </p>
            )}
            {pickupLocation && (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Accuracy: about {Math.round(pickupLocation.accuracy)} m - Captured {new Date(
                  pickupLocation.timestamp,
                ).toLocaleString()}
              </p>
            )}
          </Card>
        </div>

        <Card className="booking-summary p-5 sm:p-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
              <BusFront size={19} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Trip Summary</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Review before booking.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 border-t border-[var(--border)] pt-5 text-sm">
            <SummaryItem label="Route" value={route?.routeName || bus.route?.routeName || "Not available"} />
            <SummaryItem label="Bus preview" value={bus.busNumber} />
            <SummaryItem label="Driver" value={driver?.name || "Not assigned"} />
            <SummaryItem label="Selected seat" value={selectedSeat || (configured ? "Select a seat" : "Seat assigned on boarding")} />
            <SummaryItem
              label="Pickup"
              value={pickupLocation ? "Location will be shared" : "Not shared"}
            />
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
            <Users size={16} className="mt-0.5 shrink-0 text-[var(--primary-ink)]" />
            {availableSeats == null
              ? "Seat availability unavailable"
              : `${availableSeats} seats available`}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--border)] p-3 text-sm text-[var(--muted)]">
            <WalletCards size={16} className="mt-0.5 shrink-0 text-[var(--primary-ink)]" />
            <p>
              Payment status will be <strong className="text-[var(--foreground)]">Pending</strong>. Online payment is not available in Smart Safar yet.
            </p>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--success)]" />
            We&apos;ll confirm the route, bus, driver, active shift, and seat before creating your booking.
          </div>

          {submitError && (
            <p role="alert" className="mt-4 text-sm leading-5 text-[var(--danger)]">
              {submitError}
            </p>
          )}
          {!authLoading && !isAuthenticated && (
            <p className="mt-4 text-sm leading-5 text-[var(--muted)]">
              Log in is required before the seat can be reserved.
            </p>
          )}
          <Button
            type="button"
            className="mt-6 w-full gap-2"
            disabled={authLoading || !isAuthenticated || (configured && (!selectedSeat || seats.find((seat) => seat.label === selectedSeat)?.status !== "available")) || isFull || submitting}
            onClick={continueToConfirmation}
          >
            {submitting
              ? "Creating booking..."
              : !online
                ? "Save pending request"
                : isAuthenticated
                ? "Book and View Confirmation"
                : "Log in to continue"}
            <ArrowRight size={16} />
          </Button>
        </Card>
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      <Footer />
    </div>
  );
}

function SeatSelectionSkeleton() {
  return <div className="booking-layout grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)] lg:items-start" role="status" aria-label="Loading seat availability">
    <Card treatment="operational" className="p-5 sm:p-6"><span className="block h-5 w-40 rounded bg-[var(--skeleton)]" /><span className="mt-3 block h-4 w-3/5 rounded bg-[var(--skeleton)]" /><div className="mt-6 grid grid-cols-4 gap-3 rounded-[1.75rem] border border-[var(--primary-border)] p-5 sm:grid-cols-5">{Array.from({ length: 20 }, (_, index) => <span key={index} className="aspect-square rounded-lg bg-[var(--skeleton)]" />)}</div></Card>
    <Card treatment="stat" className="space-y-4 p-5"><span className="block h-5 w-32 rounded bg-[var(--skeleton)]" /><span className="block h-4 w-full rounded bg-[var(--skeleton)]" /><span className="block h-4 w-4/5 rounded bg-[var(--skeleton)]" /><span className="block h-12 w-full rounded-xl bg-[var(--skeleton)]" /></Card>
  </div>;
}

function SummaryItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 break-words font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function SeatButton({ seat, selected, disabled, onSelect }) {
  return <button type="button" disabled={disabled} aria-label={`Seat ${seat.label}, ${selected ? "selected" : seat.status === "booked" ? "booked online" : seat.status === "occupied" ? "occupied by walk-in passenger" : "available"}`} aria-pressed={selected} title={`Seat ${seat.label}`} className={`seat-position overflow-hidden seat-position--${seat.status} ${selected ? "!bg-[var(--primary)] !text-white" : ""}`} onClick={() => onSelect(seat.label)}>{selected ? <Check size={15} /> : <span className="block max-w-full truncate px-1">{seat.label}</span>}</button>;
}
function sectionLabel(seat) {
  if (seat?.section === "gents") return "Gents section";
  if (seat?.section === "ladies") return "Ladies section";
  return null;
}
function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Circle size={12} className={color} fill="currentColor" /> {label}
    </span>
  );
}

function StateCard({ title, description }) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <Link
        href="/booking"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)]"
      >
        Back to booking
      </Link>
    </Card>
  );
}
