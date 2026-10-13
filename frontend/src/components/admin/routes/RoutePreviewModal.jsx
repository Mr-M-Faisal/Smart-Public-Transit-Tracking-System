"use client";


import { useEffect, useMemo, useState } from "react";
import Link from "../../common/SmartLink";
import { BusFront, MapPin } from "lucide-react";
import { AdminDialog } from "../AdminDialog";
import { Button } from "../../common/Button";
import { ErrorState } from "../../common/ErrorState";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { ClientTransitMap } from "../../map/MapShell";
import { StopMarker } from "../../map/MapShell";
import { MapViewport } from "../../map/MapShell";
import { getOrderedRouteStops, getStopPosition } from "../../../lib/transit/coordinates";
import { stopService } from "../../../services/stopService";
import { busService } from "../../../services/busService";

export function RoutePreviewModal({ route, onClose }) {
  const routeId = route?._id;
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState({ routeId: null, stops: [], buses: [], status: "loading", busError: false });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      if (!active || !routeId) return;
      setData({ routeId, stops: [], buses: [], status: "loading", busError: false });
      const [stopResult, busResult] = await Promise.allSettled([
        stopService.listByRoute(routeId, { signal: controller.signal }),
        busService.list({ route: routeId }),
      ]);
      if (!active) return;
      const stopsLoaded = stopResult.status === "fulfilled" && Array.isArray(stopResult.value);
      const busesLoaded = busResult.status === "fulfilled" && Array.isArray(busResult.value);
      setData({
        routeId,
        stops: stopsLoaded ? getOrderedRouteStops(stopResult.value, routeId) : [],
        buses: busesLoaded ? busResult.value : [],
        status: stopsLoaded ? "ready" : "error",
        busError: !busesLoaded,
      });
    }
    queueMicrotask(load);
    return () => { active = false; controller.abort(); };
  }, [routeId, retry]);

  const current = data.routeId === routeId ? data : { stops: [], buses: [], status: "loading" };
  const stops = current.stops;
  const mappedStops = useMemo(() => stops.filter((stop) => getStopPosition(stop)), [stops]);
  const positions = useMemo(() => mappedStops.map(getStopPosition), [mappedStops]);
  if (!route) return null;
  const reload = () => setRetry((value) => value + 1);

  return <AdminDialog id="route-preview" title={route.routeName} descriptionId="route-preview-help" onClose={onClose} className="max-w-2xl">
    <p id="route-preview-help" className="mt-4 break-words text-sm text-[var(--muted)]">{route.startPoint} to {route.endPoint}</p>
    <div className="mt-5 space-y-5">
      {current.status === "loading" ? <div className="grid min-h-48 place-items-center"><LoadingSpinner label="Loading route details..." /></div> : <>
        {current.status === "error" ? <ErrorState title="Unable to load route stops" description="The saved stop list could not be confirmed. Check your connection and retry." action={<Button type="button" onClick={reload} className="min-h-12">Retry</Button>} /> : <>
          {positions.length ? <>
            <p role="status" className="text-sm text-[var(--muted)]">Map shows {mappedStops.length} of {stops.length} saved stops. A route line is not available for this route.</p>
            <div className="h-[280px] overflow-hidden rounded-2xl border border-[var(--border)]">
              <ClientTransitMap key={routeId} center={positions[0]} zoom={13} className="h-full w-full !min-h-0">
                <MapViewport positions={positions} focusKey={routeId} />
                {mappedStops.map((stop) => <StopMarker key={stop._id} position={getStopPosition(stop)} stop={stop} />)}
              </ClientTransitMap>
            </div>
          </> : <div className="flex items-center gap-3 rounded-xl bg-[var(--background)] p-4 text-sm text-[var(--muted)]"><MapPin size={16} className="shrink-0" /><p>{stops.length ? "No valid stop coordinates are available for this route." : "No stops have been added to this route."}</p></div>}
          {mappedStops.length < stops.length && <p role="status" className="text-sm text-[var(--warning)]">Stops without valid coordinates: {stops.length - mappedStops.length}. All saved stops remain listed below.</p>}
          <section aria-labelledby="route-preview-stops">
            <h3 id="route-preview-stops" className="mb-3 text-sm font-bold">Stops ({stops.length})</h3>
            {stops.length > 0 && <ol className="space-y-2">{stops.map((stop) => {
              const position = getStopPosition(stop);
              return <li key={stop._id} data-stop-id={stop._id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
                {Number.isFinite(stop.stopOrder) && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary-ink)]">{stop.stopOrder}</span>}
                <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{stop.stopName}</p><p className="mt-1 break-words text-xs text-[var(--muted)]">{position ? "Location saved" : "Location is not available"}</p></div>
              </li>;
            })}</ol>}
          </section>
        </>}
        <section aria-labelledby="route-preview-buses">
          <h3 id="route-preview-buses" className="mb-3 text-sm font-bold">Assigned buses{!current.busError && " (" + current.buses.length + ")"}</h3>
          {current.busError ? <div role="alert" className="grid gap-3"><p className="text-sm text-[var(--danger)]">Assigned buses could not be loaded.</p><Button type="button" variant="secondary" className="min-h-11 justify-self-start" onClick={reload}>Retry route details</Button></div> : !current.buses.length ? <p className="text-sm text-[var(--muted)]">No buses are currently assigned to this route.</p> : <div className="grid gap-2 sm:grid-cols-2">{current.buses.map((bus) => <Link key={bus._id} href={"/buses/" + bus._id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] p-3 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"><BusFront size={16} className="shrink-0 text-[var(--primary-ink)]" /><div className="min-w-0"><p className="break-words text-sm font-semibold">{bus.busNumber}</p><p className="text-xs capitalize text-[var(--muted)]">{bus.status}</p></div></Link>)}</div>}
        </section>
      </>}
    </div>
    <div className="mt-5 border-t border-[var(--border)] pt-4"><Link href={"/routes/" + routeId} className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--primary-soft)]">View public route page</Link></div>
  </AdminDialog>;
}
