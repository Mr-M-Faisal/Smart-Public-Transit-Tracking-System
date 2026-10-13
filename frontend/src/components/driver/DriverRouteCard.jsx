import Link from "../common/SmartLink";
import { Card } from "../common/Card";

export function DriverRouteCard({ route, stops, nextStopId, errors }) {
  const nextIndex = stops.findIndex((stop) => stop._id === nextStopId);

  return (
    <Card treatment="operational" className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Route progress</h2>
        {route && <Link href={`/routes/${route._id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary-ink)]">View route</Link>}
      </div>
      {errors.route ? <p role="alert" className="mt-2 text-sm text-[var(--danger)]">Unable to load route details. Refresh the dashboard to try again.</p> : !route && <p className="mt-2 text-sm text-[var(--muted)]">No route assigned.</p>}
      {errors.stops ? (
        <p role="alert" className="mt-3 text-sm text-[var(--danger)]">Unable to load stops. Refresh the dashboard to try again.</p>
      ) : !stops.length ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No stops are available for this route.</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-[var(--muted)]">{nextIndex < 0 ? "Stop progress is unavailable until the next stop is reported." : "Stops are shown in route order relative to the next stop."}</p>
          <ol aria-label="Route stops" tabIndex={0} className="mt-4 max-h-96 overflow-y-auto rounded-xl focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
            {stops.map((stop, index) => (
              <li key={stop._id} aria-current={stop._id === nextStopId ? "step" : undefined} className={`flex min-w-0 gap-3 border-l-2 px-3 py-3 ${stop._id === nextStopId ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)]"}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-xs font-bold">{index + 1}</span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{stop.stopName}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{nextIndex < 0 ? "Progress unavailable" : index === nextIndex ? "Next stop" : index < nextIndex ? "Earlier stop" : "Upcoming stop"}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}
