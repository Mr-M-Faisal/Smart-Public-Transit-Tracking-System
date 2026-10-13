"use client";


import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { BusFront, ArrowRight,
  CheckCircle2,
  Route as RouteIcon, } from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { CardBackdrop } from "../common/CardBackdrop";
import { ErrorState } from "../common/ErrorState";
import { useTransitQuery } from "../../hooks/useTransitQuery";
import { transitQueries } from "../../lib/query/transitQueries";
import { CacheStatus, useOnline } from "../common/CacheStatus";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../lib/auth/token";
import { BookingProgress } from "./BookingProgress";

const bookingSchema = z.object({
  route: z.string().min(1, "Select a route."),
  bus: z.string().optional(),
});


function busStatusLabel(status) {
  if (status === "active") return "Active";
  if (status === "idle") return "Idle";
  if (status === "maintenance") return "Maintenance";
  return "Status unavailable";
}

function getRouteId(bus) {
  return bus?.route?._id || bus?.route || "";
}

function getDriverId(bus) {
  return bus?.driver?._id || bus?.driver || "";
}

function getDriverName(bus) {
  return bus?.driver?.name || (getDriverId(bus) ? "Assigned driver" : "No driver assigned");
}

function sortEligibleBuses(left, right) {
  const leftUpdate = left.lastLocationUpdate ? new Date(left.lastLocationUpdate).getTime() : 0;
  const rightUpdate = right.lastLocationUpdate ? new Date(right.lastLocationUpdate).getTime() : 0;
  if (leftUpdate !== rightUpdate) return rightUpdate - leftUpdate;
  const numberOrder = String(left.busNumber || "").localeCompare(String(right.busNumber || ""));
  return numberOrder || String(left._id).localeCompare(String(right._id));
}

export default function BookingPage({ initialBusId = "", initialRouteId = "" }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const routesQuery = useTransitQuery(transitQueries.routes());
  const busesQuery = useTransitQuery({ ...transitQueries.buses(), staleTime: 0 });
  const online = useOnline();
  const routes = routesQuery.data || [];
  const buses = online && !busesQuery.isError ? busesQuery.data || [] : [];
  const routesLoading = routesQuery.loading;
  const loadError = routesQuery.isError && !routesQuery.data ? "Routes unavailable. Please reconnect and retry." : null;
  const [submitError, setSubmitError] = useState("");
  const [manualSelection, setManualSelection] = useState(Boolean(initialBusId));

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      route: initialRouteId || "",
      bus: initialBusId || "",
    },
  });

  const selectedRouteId = useWatch({ control, name: "route" });
  const selectedBusId = useWatch({ control, name: "bus" });
  const selectedRoute = routes.find((route) => route._id === selectedRouteId);

  const eligibleBuses = buses
        .filter(
          (bus) =>
            getRouteId(bus) === selectedRouteId &&
            bus.status === "active" &&
            Number(bus.availableSeats) > 0 &&
            Boolean(getDriverId(bus)),
        )
        .sort(sortEligibleBuses);

  const automaticBus = eligibleBuses[0] || null;
  const selectedBus = eligibleBuses.find((bus) => bus._id === selectedBusId) || null;
  const bookingBus = manualSelection ? selectedBus : automaticBus;
  const noEligibleBus = Boolean(selectedRouteId) && !bookingBus;

  useEffect(() => {
    if (!initialBusId || !busesQuery.data) return;
    const initialBus = busesQuery.data.find((bus) => bus._id === initialBusId);
    const routeId = getRouteId(initialBus);
    if (routeId) setValue("route", routeId);
    setValue("bus", initialBusId);
  }, [initialBusId, busesQuery.data, setValue]);

  function handleRouteChange(event) {
    setValue("route", event.target.value, { shouldValidate: true });
    setValue("bus", "", { shouldValidate: true });
    setSubmitError("");
  }

  function toggleManualSelection() {
    setSubmitError("");
    const next = !manualSelection;
    setManualSelection(next);
    setValue("bus", next ? automaticBus?._id || "" : "", { shouldValidate: false });
  }

  function continueToSeatSelection(values) {
    setSubmitError("");
    if (!online) { setSubmitError("Reconnect before choosing a live bus and seat."); return; }
    if (!bookingBus) {
      setSubmitError(
        "No active bus is available for this route right now.",
      );
      return;
    }

    const target =
      "/booking/" +
      bookingBus._id +
      "/seat?route=" +
      encodeURIComponent(values.route) +
      "&mode=" +
      (manualSelection ? "manual" : "route");

    if (!isAuthenticated || !getAccessToken()) {
      router.push("/login?redirect=" + encodeURIComponent(target));
      return;
    }
    router.push(target);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)]">
      <Navbar /><CacheStatus query={routesQuery} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="premium-card premium-card--primary premium-card--imagery p-5 sm:p-7">
          <CardBackdrop visual="booking" priority />
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">
            Book your journey
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Choose your route
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Select a route and Smart Safar will show an active bus with available seats.
          </p>
        </header>

        <BookingProgress currentStep={1} />

        {routesLoading && !routes.length ? <BookingOptionsSkeleton /> : loadError ? (
          <div className="mt-8">
            <ErrorState
              title="Unable to load routes"
              description="We couldn't retrieve booking options right now."
              action={
                <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(continueToSeatSelection)}
            className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)] lg:items-start"
          >
            <Card treatment="operational" className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
                  <RouteIcon size={19} />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-[var(--foreground)]">Route selection</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Choose a route to see the active service.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5">
                <Field label="Route" error={errors.route?.message}>
                  <select
                    {...register("route", { onChange: handleRouteChange })}
                    value={selectedRouteId || ""}
                    className="field-input"
                  >
                    <option value="">Select route</option>
                    {routes.map((route) => (
                      <option key={route._id} value={route._id} disabled={route.isActive === false}>
                        {route.routeName} · {route.startPoint} to {route.endPoint}
                      </option>
                    ))}
                  </select>
                </Field>

                {selectedRoute && (
                  <section className="rounded-2xl border border-[var(--primary-border)] bg-[var(--primary-soft)] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Selected route</p>
                    <div className="mt-3 grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Start</p>
                        <p className="mt-1 break-words font-semibold text-[var(--foreground)]">{selectedRoute.startPoint || "Route start"}</p>
                      </div>
                      <ArrowRight size={16} className="text-[var(--primary-ink)] sm:hidden" aria-hidden="true" />
                      <ArrowRight size={18} className="hidden text-[var(--primary-ink)] sm:block" aria-hidden="true" />
                      <div className="min-w-0 sm:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Destination</p>
                        <p className="mt-1 break-words font-semibold text-[var(--foreground)]">{selectedRoute.endPoint || "Route destination"}</p>
                      </div>
                    </div>
                  </section>
                )}

                {selectedRouteId && (
                  <section className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary-ink)]">
                          Active service
                        </p>
                        <h3 className="mt-1 font-bold text-[var(--foreground)]">
                          {bookingBus?.busNumber || "No active bus available"}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {bookingBus
                            ? getDriverName(bookingBus) +
                              " · " +
                              bookingBus.availableSeats +
                              " seats available"
                            : "No active bus is available for this route right now."}
                        </p>
                      </div>
                      {bookingBus && <Badge tone="success">{busStatusLabel(bookingBus.status)}</Badge>}
                    </div>

                    {bookingBus && <dl className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs font-medium text-[var(--muted)]">Driver</dt><dd className="mt-1 font-semibold text-[var(--foreground)]">{getDriverName(bookingBus)}</dd></div>
                      <div><dt className="text-xs font-medium text-[var(--muted)]">Available seats</dt><dd className="mt-1 font-semibold text-[var(--foreground)]">{bookingBus.availableSeats} seats available</dd></div>
                    </dl>}

                    {manualSelection && (
                      <div className="mt-4">
                        <Field label="Choose an active bus" error={errors.bus?.message}>
                          <select {...register("bus")} className="field-input">
                            <option value="">Select a bus</option>
                            {eligibleBuses.map((bus) => (
                              <option key={bus._id} value={bus._id}>
                                {bus.busNumber} · {getDriverName(bus)} · {bus.availableSeats} seats
                              </option>
                            ))}
                          </select>
                        </Field>
                        {!eligibleBuses.length && <p className="mt-3 text-sm text-[var(--muted)]">There&apos;s no available bus for this route right now.</p>}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={toggleManualSelection}
                      className="mt-4 min-h-10 text-sm font-semibold text-[var(--primary-ink)] hover:text-[var(--primary-ink)]"
                    >
                      {manualSelection ? "Use automatic service" : "Choose a different bus"}
                    </button>

                    {!manualSelection && bookingBus && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-xs leading-5 text-[var(--muted)]">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--success)]" />
                        This service will be checked again when you continue to seat selection.
                      </div>
                    )}
                  </section>
                )}

              </div>
            </Card>

            <Card treatment="operational" className="p-5 sm:p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]">
                  <BusFront size={19} />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-[var(--foreground)]">Booking Summary</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">Seat selection comes next.</p>
                </div>
              </div>
              <dl className="mt-6 grid gap-4 border-t border-[var(--border)] pt-5 text-sm">
                <SummaryRow label="Route" value={selectedRoute?.routeName || "Not selected"} />
                <SummaryRow label="Bus" value={bookingBus?.busNumber || "Awaiting route"} />
                <SummaryRow label="Driver" value={bookingBus ? getDriverName(bookingBus) : "Awaiting route"} />
                <SummaryRow label="Seat" value="To be selected" />
              </dl>

              {noEligibleBus && (
                <div className="mt-5 rounded-xl border border-[#f4cccc] bg-[#fff8f8] p-3 text-sm text-[var(--danger)]">
                  No active bus is available for this route right now.
                </div>
              )}
              {submitError && (
                <p className="mt-4 text-sm leading-6 text-[var(--danger)]">{submitError}</p>
              )}
              {!authLoading && !isAuthenticated && (
                <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
                  Sign in is required before choosing a seat.
                </div>
              )}
              <Button
                type="submit"
                className="mt-6 w-full gap-2"
                disabled={authLoading || !isAuthenticated || routesLoading || !selectedRouteId || !bookingBus}
              >
                {isAuthenticated ? "Continue to seats" : "Log in to continue"}
                <ArrowRight size={16} />
              </Button>
            </Card>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-[var(--foreground)]">
      {label}
      {children}
      {error && <span className="text-xs font-normal text-[var(--danger)]">{error}</span>}
    </label>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="max-w-[62%] break-words text-right font-semibold text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

function BookingOptionsSkeleton() {
  return <div className="mt-8 grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)] lg:items-start" role="status" aria-label="Loading booking options">
    <Card treatment="operational" className="space-y-5 p-5 sm:p-6"><span className="block h-5 w-36 rounded bg-[var(--skeleton)]" /><span className="block h-12 w-full rounded-xl bg-[var(--skeleton)]" /><span className="block h-12 w-full rounded-xl bg-[var(--skeleton)]" /><span className="block h-12 w-full rounded-xl bg-[var(--skeleton)]" /></Card>
    <Card treatment="stat" className="space-y-4 p-5"><span className="block h-5 w-28 rounded bg-[var(--skeleton)]" /><span className="block h-4 w-full rounded bg-[var(--skeleton)]" /><span className="block h-4 w-4/5 rounded bg-[var(--skeleton)]" /><span className="block h-12 w-full rounded-xl bg-[var(--skeleton)]" /></Card>
  </div>;
}
