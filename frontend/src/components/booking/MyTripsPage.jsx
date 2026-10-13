"use client";

import Link from "../common/SmartLink";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  RefreshCw,
  Ticket,
  Trash2,
  XCircle,
} from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { CardBackdrop } from "../common/CardBackdrop";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { bookingService } from "../../services/bookingService";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../lib/auth/token";
import { readPrivateSnapshot, savePrivateSnapshot } from "../../lib/live-map/liveMapStorage";
import { discardPendingBooking, listPendingBookings, retryPendingBooking, syncPendingBookings } from "../../lib/offline/bookingQueue";

const filters = ["all", "confirmed", "completed", "cancelled"];

function formatDateTime(value) {
  if (!value) return { date: "Not provided", time: "Not provided" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Not provided", time: "Not provided" };
  return {
    date: date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

function capitalize(value, fallback = "Not provided") {
  if (!value) return fallback;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusTone(status) {
  if (status === "confirmed" || status === "paid") return "success";
  if (status === "cancelled" || status === "failed") return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}

function pickupStatus(booking) {
  if (booking.locationSharingActive) return "Shared with assigned driver";
  if (booking.pickupLocation) return "Sharing stopped";
  return "Not shared";
}

export default function MyTripsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [pendingRequests, setPendingRequests] = useState([]);

  const loadPendingRequests = useCallback(async () => {
    const token = getAccessToken();
    setPendingRequests(await listPendingBookings(token));
  }, []);

  const loadBookings = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const token = getAccessToken();
    const cached = await readPrivateSnapshot(token, "my-trips");
    const cachedBookings = Array.isArray(cached?.data?.bookings) ? cached.data.bookings : [];
    if (cachedBookings.length) setBookings(cachedBookings);
    if (!navigator.onLine) {
      setError(cachedBookings.length ? "offline" : "offline-empty");
      setLoading(false);
      return;
    }
    try {
      const response = await bookingService.getMyBookings();
      const list = Array.isArray(response) ? response : response.bookings;
      if (!Array.isArray(list)) throw new Error("Unexpected bookings response");
      setBookings(list);
      savePrivateSnapshot(token, "my-trips", { bookings: list });
    } catch (requestError) {
      if (requestError.response?.status === 401) setError("auth");
      else {
        console.error("Unable to load booking history", requestError);
        setError(cachedBookings.length ? "offline" : "load");
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    Promise.resolve().then(() => loadBookings());
  }, [loadBookings]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    Promise.resolve().then(() => loadPendingRequests());
    window.addEventListener("smart-safar:booking-queue", loadPendingRequests);
    return () => window.removeEventListener("smart-safar:booking-queue", loadPendingRequests);
  }, [isAuthenticated, loadPendingRequests]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  const visibleBookings = useMemo(
    () => (filter === "all" ? bookings : bookings.filter((booking) => booking.status === filter)),
    [bookings, filter],
  );

  async function cancelBooking(booking) {
    if (!online) {
      setCancelError("You're offline. Connect to the internet before cancelling a booking.");
      return;
    }
    const confirmed = window.confirm(
      "Cancel this booking? Its seat will be released and pickup-location sharing will stop.",
    );
    if (!confirmed) return;

    setCancellingId(booking._id);
    setCancelError("");
    try {
      const response = await bookingService.cancel(booking._id);
      const updated = response.booking;
      if (!updated?._id) throw new Error("Cancellation response did not include a booking");
      setBookings((current) =>
        current.map((item) => (item._id === updated._id ? updated : item)),
      );
    } catch (requestError) {
      setCancelError(
        requestError.response?.data?.message || "Unable to cancel this booking. Please try again.",
      );
    } finally {
      setCancellingId("");
    }
  }

  async function reviewPendingRequest(request, action) {
    const token = getAccessToken();
    if (action === "discard") await discardPendingBooking(token, request.id);
    else {
      await retryPendingBooking(token, request.id);
      if (navigator.onLine) await syncPendingBookings(token);
    }
    loadPendingRequests();
  }

  if (authLoading || (isAuthenticated && loading && !bookings.length)) {
    return (
      <PageShell>
        <div className="grid min-h-96 place-items-center">
          <LoadingSpinner label="Loading your trips..." />
        </div>
      </PageShell>
    );
  }
  if (!isAuthenticated || error === "auth") {
    return (
      <PageShell>
        <StateCard
          title="Log in to view your trips"
          description="Your booking history is available after you log in."
          actionHref="/login?redirect=/my-trips"
          actionLabel="Log in"
        />
      </PageShell>
    );
  }
  if (error === "load") {
    return (
      <PageShell>
        <ErrorState
          title="Unable to load trips"
          description="We couldn't retrieve your booking history right now."
          action={
            <Button type="button" variant="secondary" onClick={loadBookings}>
              <RefreshCw size={16} /> Try again
            </Button>
          }
        />
      </PageShell>
    );
  }
  if (error === "offline-empty") {
    return <PageShell><StateCard title="No saved trips yet" description="Connect to the internet and open My Trips once to save your booking summaries on this device." actionHref="/" actionLabel="Back to home" /></PageShell>;
  }

  return (
    <PageShell>
      <header className="premium-card premium-card--primary premium-card--imagery p-5 sm:p-7">
        <CardBackdrop visual="journey" priority />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">
          Your travel
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          My Trips
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          View booking, payment, pickup, and assignment details from your private booking history.
        </p>
      </header>

      {error === "offline" && <p role="status" className="mt-5 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-sm text-[var(--warning)]">Saved booking information — connect to refresh. Booking changes are unavailable offline.</p>}

      {pendingRequests.some((request) => request.status !== "confirmed") && <section className="mt-5 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--warning)]">Pending confirmation</p><h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">Saved booking requests</h2><div className="mt-3 grid gap-3">{pendingRequests.filter((request) => request.status !== "confirmed").map((request) => <div key={request.id} className="rounded-xl border border-[var(--warning-border)] bg-white/70 p-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{request.summary?.routeName || "Saved route"}</strong><p className="mt-1 text-[var(--muted)]">{request.summary?.busNumber || "Saved bus"}{request.summary?.seatNumber ? ` · Seat ${request.summary.seatNumber}` : ""}</p></div><Badge tone={request.status === "needs-attention" ? "danger" : "warning"}>{request.status === "needs-attention" ? "Needs attention" : request.status === "synchronizing" ? "Synchronizing" : "Pending"}</Badge></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{request.message || "This is not a confirmed ticket. Smart Safar will recheck availability when connected."}</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" className="min-h-9 text-xs" disabled={!online || request.status === "synchronizing"} onClick={() => reviewPendingRequest(request, "retry")}>Retry when online</Button><Button type="button" variant="secondary" className="min-h-9 text-xs text-[var(--danger)]" onClick={() => reviewPendingRequest(request, "discard")}>Discard</Button></div></div>)}</div></section>}

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Trip filters">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-10 rounded-xl px-4 text-sm font-semibold capitalize transition ${
              filter === value
                ? "bg-[var(--primary)] text-[var(--primary-contrast)]"
                : "border border-[var(--border)] bg-white text-[var(--muted)] hover:text-[var(--primary-ink)]"
            }`}
          >
            {value === "all" ? "All" : value}
          </button>
        ))}
      </div>

      {cancelError && (
        <p role="alert" className="mt-4 rounded-xl bg-[#fde8e8] p-3 text-sm text-[var(--danger)]">
          {cancelError}
        </p>
      )}

      {bookings.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No trips yet"
            description="You haven't booked any trips yet."
            action={
              <Link
                href="/booking"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)]"
              >
                Book a Trip <ArrowRight size={16} />
              </Link>
            }
          />
        </div>
      ) : visibleBookings.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No matching trips"
            description="There are no bookings with this status."
            action={
              <Button type="button" variant="secondary" onClick={() => setFilter("all")}>
                View all trips
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-8">
          <TripSection
            title={filter === "all" ? "All Trips" : `${capitalize(filter)} Trips`}
            icon={filter === "confirmed" ? CalendarClock : Ticket}
            bookings={visibleBookings}
            cancellingId={cancellingId}
            onCancel={cancelBooking}
            readOnly={!online || error === "offline"}
          />
        </div>
      )}
    </PageShell>
  );
}

function TripSection({ title, icon: Icon, bookings, cancellingId, onCancel, readOnly }) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
          <Icon size={17} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">{title}</h2>
          <p className="text-sm text-[var(--muted)]">
            {bookings.length} booking{bookings.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {bookings.map((booking) => (
          <TripCard
            key={booking._id}
            booking={booking}
            cancelling={cancellingId === booking._id}
            onCancel={onCancel}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
}

function TripCard({ booking, cancelling, onCancel, readOnly }) {
  const bus = booking.bus && typeof booking.bus === "object" ? booking.bus : {};
  const route = booking.route && typeof booking.route === "object" ? booking.route : {};
  const driver = booking.driver && typeof booking.driver === "object" ? booking.driver : {};
  const created = formatDateTime(booking.createdAt);
  const confirmationHref = `/booking/${booking._id}/confirmation`;

  return (
    <Card treatment="operational" className="flex min-w-0 flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-words text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">
            {route.routeName || "Route unavailable"}
          </p>
          <h3 className="mt-1 break-words text-lg font-bold text-[var(--foreground)]">
            {bus.busNumber || "Bus unavailable"}
          </h3>
        </div>
        <Badge tone={statusTone(booking.status)}>{capitalize(booking.status)}</Badge>
      </div>

      <dl className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-2">
        <Detail label="Booking ID" value={booking._id} />
        <Detail label="Driver" value={driver.name || "Not provided"} />
        <Detail label="Seat" value={booking.seatNumber || "Not assigned"} />
        <Detail label="Booked on" value={created.date} />
        <Detail label="Booked at" value={created.time} />
        <Detail label="Pickup location" value={pickupStatus(booking)} />
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
        <span className="text-xs text-[var(--muted)]">Payment</span>
        <Badge tone={statusTone(booking.paymentStatus)}>
          {capitalize(booking.paymentStatus, "Unavailable")}
        </Badge>
        {booking.paymentMethod && (
          <span className="text-xs capitalize text-[var(--muted)]">· {booking.paymentMethod}</span>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-end">
        {booking.status === "confirmed" && (
          <Button
            type="button"
            variant="secondary"
            className="min-h-10 gap-2 text-[var(--danger)]"
            disabled={cancelling || readOnly}
            onClick={() => onCancel(booking)}
          >
            <Trash2 size={15} /> {cancelling ? "Cancelling..." : readOnly ? "Connect to cancel" : "Cancel booking"}
          </Button>
        )}
        <Link
          href={confirmationHref}
          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--primary-ink)] hover:border-[var(--primary)]"
        >
          View Details <ArrowRight size={15} />
        </Link>
      </div>
    </Card>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
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

function StateCard({ title, description, actionHref, actionLabel }) {
  return (
    <Card treatment="operational" className="mx-auto max-w-lg p-8 text-center">
      <XCircle className="mx-auto text-[var(--muted)]" size={30} />
      <h1 className="mt-3 text-2xl font-bold text-[var(--foreground)]">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <Link
        href={actionHref}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)]"
      >
        {actionLabel}
      </Link>
    </Card>
  );
}
