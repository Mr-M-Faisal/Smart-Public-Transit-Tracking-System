"use client";

import { useMemo } from "react";
import { ClientTransitMap } from "../map/MapShell";
import { BusMarker } from "../map/MapShell";
import { PassengerMarker } from "../map/MapShell";
import { StopMarker } from "../map/MapShell";
import { RoutePolyline } from "../map/MapShell";
import { MapControls } from "../map/MapShell";
import { MapViewport } from "../map/MapShell";
import { getBusPosition } from "../../lib/transit/format";
import { isValidPosition } from "../../lib/transit/coordinates";

export function DriverMap({ bus, stops, nextStopId, connection, passengers = [] }) {
  const busPosition = useMemo(() => getBusPosition(bus), [bus]);
  const mappedStops = useMemo(
    () => stops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)),
    [stops],
  );
  const routePositions = useMemo(
    () => mappedStops.map((stop) => [stop.latitude, stop.longitude]),
    [mappedStops],
  );
  const passengerPositions = useMemo(
    () =>
      passengers
        .map((item) => [item.pickupLocation?.latitude, item.pickupLocation?.longitude])
        .filter(isValidPosition),
    [passengers],
  );
  const mapPositions = useMemo(
    () => [...routePositions, ...(busPosition ? [busPosition] : []), ...passengerPositions],
    [routePositions, busPosition, passengerPositions],
  );
  const focusKey = `${bus._id}-${passengers.map((item) => item.bookingId).join("-")}`;

  return (
    <section
      id="driver-map"
      className="min-w-0 scroll-mt-20 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-1"
      aria-label="Assigned bus, route, and passenger pickup map"
    >
      <div className="px-4 py-3">
        <h2 className="font-bold">Live route map</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {busPosition ? "Showing the last saved bus position." : "No bus location received yet."}{" "}
          Route lines connect recorded stops.
          {passengers.length
            ? ` ${passengers.length} opted-in passenger pickup${passengers.length === 1 ? " is" : "s are"} visible.`
            : ""}
        </p>
        {connection !== "Connected" && (
          <p role="status" className="mt-2 text-xs text-[var(--warning)]">
            Live feed: {connection}. Showing saved information while live updates reconnect.
          </p>
        )}
      </div>
      <ClientTransitMap
        center={busPosition || passengerPositions[0] || routePositions[0] || [31.4187, 73.0791]}
        zoom={14}
        className="h-[min(60vh,560px)] min-h-80 rounded-xl"
      >
        <MapViewport positions={mapPositions} focusKey={focusKey} />
        <RoutePolyline positions={routePositions} />
        {mappedStops.map((stop) => (
          <StopMarker
            key={stop._id}
            position={[stop.latitude, stop.longitude]}
            stop={{
              ...stop,
              name: `${stop.stopName}${stop._id === nextStopId ? " (Next stop)" : ""}`,
            }}
          />
        ))}
        {passengers.map((item) => (
          <PassengerMarker key={item.bookingId} passengerLocation={item} />
        ))}
        {busPosition && <BusMarker position={busPosition} bus={bus} />}
        <MapControls
          onShowAll={(map) =>
            mapPositions.length && map.fitBounds(mapPositions, { padding: [32, 32], maxZoom: 15 })
          }
        />
      </ClientTransitMap>
    </section>
  );
}