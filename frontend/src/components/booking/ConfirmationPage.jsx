"use client";


import Link from "../common/SmartLink";
import { useCallback, useEffect, useState } from "react";
import { BusFront, ArrowLeft,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Ticket,
  UserRound,
  WalletCards, } from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { BookingProgress } from "./BookingProgress";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { CardBackdrop } from "../common/CardBackdrop";
import { ErrorState } from "../common/ErrorState";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { bookingService } from "../../services/bookingService";
import { busService } from "../../services/busService";
import { routeService } from "../../services/routeService";
import { useAuth } from "../../hooks/useAuth";

function formatDateTime(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function capitalize(value, fallback = "Not provided") {
  if (!value) return fallback;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusTone(status) {
  if (status === "confirmed" || status === "paid") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}

function pickupStatus(booking) {
  if (booking.locationSharingActive) return "Shared with assigned driver";
  if (booking.pickupLocation) return "Sharing stopped";
  return "Not shared";
}

export default function ConfirmationPage({ bookingId }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [booking, setBooking] = useState(null);
  const [bus, setBus] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConfirmation = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const bookingsResponse = await bookingService.getMyBookings();
      const bookings = Array.isArray(bookingsResponse)
        ? bookingsResponse
        : bookingsResponse.bookings || [];
      const currentBooking = bookings.find((item) => String(item._id) === String(bookingId));
      if (!currentBooking) {
        setBooking(null);
        setError("not-found");
        return;
      }

      let busData = currentBooking.bus || null;
      if (busData && typeof busData !== "object") busData = await busService.get(busData);

      let routeData = currentBooking.route || busData?.route || null;
      if (routeData && typeof routeData !== "object") routeData = await routeService.get(routeData);

      setBooking(currentBooking);
      setBus(busData);
      setRoute(routeData);
    } catch (requestError) {
      if (requestError.response?.status === 401) setError("auth");
      else {
        console.error("Unable to load booking confirmation", requestError);
        setError("error");
      }
    } finally {
      setLoading(false);
    }
  }, [bookingId, isAuthenticated]);

  useEffect(() => {
    Promise.resolve().then(() => loadConfirmation());
  }, [loadConfirmation]);

  if (authLoading || (isAuthenticated && loading && !booking)) {
    return (
      <PageShell>
        <div className="grid min-h-96 place-items-center">
          <LoadingSpinner label="Loading booking confirmation..." />
        </div>
      </PageShell>
    );
  }
  if (!isAuthenticated || error === "auth") {
    const redirect = encodeURIComponent(`/booking/${bookingId}/confirmation`);
    return (
      <PageShell>
        <StateCard
          title="Log in to view this booking"
          description="Your confirmation is available only from your authenticated booking history."
          actionHref={`/login?redirect=${redirect}`}
          actionLabel="Log in"
        />
      </PageShell>
    );
  }
  if (error === "not-found") {
    return (
      <PageShell>
        <StateCard
          title="Booking not found"
          description="This booking is not in your booking history, or you are not authorized to view it."
          actionHref="/my-trips"
          actionLabel="View My Trips"
        />
      </PageShell>
    );
  }
  if (error || !booking) {
    return (
      <PageShell>
        <ErrorState
          title="Unable to load confirmation"
          description="We couldn't retrieve this booking right now."
          action={
            <Button type="button" variant="secondary" onClick={loadConfirmation}>
              <RefreshCw size={16} /> Try again
            </Button>
          }
        />
      </PageShell>
    );
  }

  const routeName = route?.routeName || bus?.route?.routeName || "Route unavailable";
  const driverName = booking.driver?.name || bus?.driver?.name || "Not provided";
  const isConfirmed = booking.status === "confirmed";

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <BookingProgress currentStep={3} />
        <section className="premium-card premium-card--primary premium-card--imagery mt-8 p-5 text-center sm:p-7">
          <CardBackdrop visual="journey" priority />
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
            <CheckCircle2 size={34} />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">
            Booking saved
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            {isConfirmed ? "Booking Confirmed" : `Booking ${capitalize(booking.status)}`}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            These are the saved details for this booking.
          </p>
        </section>

        <Card treatment="operational" className="mt-8 overflow-hidden">
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] bg-[var(--primary-soft)] p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--primary-ink)]">
                <Ticket size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">
                  Booking ID
                </p>
                <p className="mt-1 break-all font-mono text-sm font-bold text-[var(--foreground)]">
                  {booking._id}
                </p>
              </div>
            </div>
            <Badge tone={statusTone(booking.status)}>{capitalize(booking.status)}</Badge>
          </div>

          <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-2">
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">Trip details</h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <DetailRow label="Route" value={routeName} />
                <DetailRow label="Bus" value={bus?.busNumber || "Not provided"} />
                <DetailRow label="Driver" value={driverName} />
                <DetailRow label="Seat" value={booking.seatNumber || "Not assigned"} />
                <DetailRow label="Booked at" value={formatDateTime(booking.createdAt)} />
              </dl>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">Booking status</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <InfoRow
                  icon={Ticket}
                  label="Booking"
                  value={capitalize(booking.status)}
                  badgeTone={statusTone(booking.status)}
                />
                <InfoRow
                  icon={WalletCards}
                  label={`Payment · ${capitalize(booking.paymentMethod, "Method unavailable")}`}
                  value={capitalize(booking.paymentStatus, "Unavailable")}
                  badgeTone={statusTone(booking.paymentStatus)}
                />
                <InfoRow
                  icon={MapPin}
                  label="Pickup location"
                  value={pickupStatus(booking)}
                />
                <InfoRow icon={UserRound} label="Assigned driver" value={driverName} />
                <InfoRow icon={BusFront} label="Bus service" value={bus?.busNumber || "Not provided"} />
                <InfoRow icon={Clock3} label="Created" value={formatDateTime(booking.createdAt)} />
              </div>
            </section>
          </div>
        </Card>

        {booking.paymentStatus === "pending" && (
          <p className="mt-4 rounded-xl border border-[#f0d7aa] bg-[#fff9ed] p-4 text-sm leading-6 text-[#6f531d]">
            Payment is pending. Smart Safar does not currently provide a customer payment gateway, so
            no successful payment is claimed on this page.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/booking"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary-ink)]"
          >
            <ArrowLeft size={16} /> New booking
          </Link>
          <Link
            href="/my-trips"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]"
          >
            View My Trips
          </Link>
        </div>
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

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="max-w-[62%] break-words text-right font-semibold text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, badgeTone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[var(--background)] p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-ink)]">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--muted)]">{label}</p>
        {badgeTone ? (
          <Badge tone={badgeTone} className="mt-1">
            {value}
          </Badge>
        ) : (
          <p className="mt-1 break-words font-semibold text-[var(--foreground)]">{value}</p>
        )}
      </div>
    </div>
  );
}

function StateCard({ title, description, actionHref, actionLabel }) {
  return (
    <Card treatment="operational" className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
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
