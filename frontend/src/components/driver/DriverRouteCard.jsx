import Link from "../common/SmartLink";
import { Button } from "../common/Button";
import { Card } from "../common/Card";

export function DriverRouteCard({ route, stops, nextStopId, currentStopId, direction, errors, canReturn, onReturn, returnBusy, returnError }) {
  const nextIndex = stops.findIndex((stop) => stop._id === nextStopId);

  return (
    <Card treatment="operational" className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{route?.routeName || "Route"}</h2>
        {route && <Link href={`/routes/${route._id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary-ink)]">View route</Link>}
      </div>
      <p className="mt-2 text-base">{direction === "return" ? "Return" : "Outbound"}</p>
      {errors.route ? <p role="alert" className="mt-2 text-sm text-[var(--danger)]">Unable to load route details. Refresh the dashboard to try again.</p> : !route && <p className="mt-2 text-sm text-[var(--muted)]">No route assigned.</p>}
      {errors.stops ? (
        <p role="alert" className="mt-3 text-sm text-[var(--danger)]">Unable to load stops. Refresh the dashboard to try again.</p>
      ) : !stops.length ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No stops are available for this route.</p>
      ) : (
        <>

          <ol aria-label="Route stops" tabIndex={0} className="mt-4 rounded-xl focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
            {stops.map((stop, index) => (
              <li key={stop._id} aria-current={stop._id === currentStopId ? "step" : undefined} className={`flex min-w-0 gap-3 border-l-2 px-3 py-3 ${stop._id === nextStopId ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)]"}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-xs font-bold">{index + 1}</span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{stop.stopName}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{stop._id === currentStopId ? "Current stop" : index === nextIndex ? "Next stop" : nextIndex >= 0 && index < nextIndex ? "Completed" : "Upcoming"}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {canReturn && <Button type="button" className="mt-4 min-h-12 w-full" onClick={onReturn} disabled={returnBusy}>{returnBusy ? "Starting return..." : "Start Return Trip"}</Button>}
      {returnError && <p role="alert" className="mt-3 text-[var(--danger)]">{returnError}</p>}
    </Card>
  );
}
