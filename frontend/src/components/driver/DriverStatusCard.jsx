"use client";
import { useEffect, useRef, useState } from "react";
import Link from "../common/SmartLink";
import { BusFront, Clock3, Flag, LocateFixed, MapPin, Navigation, Square, Play } from "lucide-react";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { driverDisplay } from "../../lib/transit/driverDisplay";

export function DriverStatusCard({ bus, route, eta, errors = {}, direction, directionLabel, shiftActive, shiftBusy, shiftError, shiftMessage, hasRouteAssignment, gpsStatus, onShift, returnBusy, returnError, onReturn, children }) {
  const [now, setNow] = useState(0);
  const dialog = useRef(null);
  const shiftButton = useRef(null);
  useEffect(() => {
    // Expire old telemetry even when the connection stops delivering updates.
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);
  const display = driverDisplay({ bus, eta, shiftActive, gpsStatus, errors, now });
  const busy = Boolean(shiftBusy);
  function requestShift() {
    if (busy) return;
    if (shiftActive) dialog.current?.showModal();
    else onShift();
  }
  function confirmEnd() {
    dialog.current?.close();
    if (shiftActive && !busy) onShift();
  }
  return <Card treatment="operational" id="driver-shift" aria-label="Your bus and shift" className="driver-status-card driver-simple-card mt-4 p-4 sm:p-6">
    <div className="driver-simple-heading"><span className="driver-bus-icon"><BusFront size={40} aria-hidden="true" /></span><div><p>Assigned Bus</p><h2>{bus.busNumber}</h2><p>{errors.route ? "Route unavailable" : route?.routeName || bus.route?.routeName || "No route assigned"}</p></div></div>
    <div className="driver-simple-status" role="status"><span><Clock3 size={20} aria-hidden="true" />{shiftActive ? "On Duty" : "Off Duty"}</span><span><LocateFixed size={20} aria-hidden="true" />{display.gps}</span></div>
    <dl className="driver-info-boxes">
      <StatusDetail icon={MapPin} label="Current Location" value={display.currentLocation} wide description={display.currentLocation !== "Location unavailable" ? "Last reported stop" : null} />
      <StatusDetail icon={Flag} label="Next Stop" value={display.nextStop} wide />
      <StatusDetail icon={Clock3} label="Arrival Time" value={display.arrival} />
      <StatusDetail icon={Navigation} label="Direction" value={direction === "return" ? "Return" : "Outbound"} description={route ? directionLabel : null} />
    </dl>
    {gpsStatus?.state === "permission-denied" && <Link className="driver-location-link" href="/driver/tracking">Allow Location</Link>}
    {!shiftActive && <p className="mt-4 text-base text-[var(--muted)]">Start your shift to share your location.</p>}
    {onShift && <Button ref={shiftButton} type="button" variant={shiftActive ? "danger" : "primary"} disabled={busy || (!shiftActive && !hasRouteAssignment)} onClick={requestShift} aria-busy={busy} className="mt-4 min-h-14 w-full gap-2 text-lg">
      {shiftActive ? <Square size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
      {shiftBusy === "starting" ? "Starting..." : shiftBusy === "ending" ? "Ending..." : shiftActive ? "End Shift" : "Start Shift"}
    </Button>}
    {shiftError && <p role="alert" className="mt-3 text-base text-[var(--danger)]">{shiftError}</p>}
    {shiftMessage && <p role="status" className="mt-3 text-base">{shiftMessage}</p>}
    {onReturn && shiftActive && direction === "outbound" && eta?.terminalReached && <div className="mt-4"><p className="text-base font-semibold">Last stop reached</p><Button type="button" className="mt-2 min-h-12 w-full" onClick={onReturn} disabled={returnBusy || busy}>{returnBusy ? "Starting return..." : "Start Return Trip"}</Button></div>}
    {returnError && <p role="alert" className="mt-3 text-base text-[var(--danger)]">{returnError}</p>}
    {children}
    <dialog ref={dialog} className="driver-end-dialog" aria-labelledby="driver-end-title" aria-describedby="driver-end-description" onClose={() => shiftButton.current?.focus()}>
      <h2 id="driver-end-title">End your shift?</h2><p id="driver-end-description">Your bus will go off duty.</p><div><Button type="button" variant="secondary" autoFocus onClick={() => dialog.current?.close()}>Keep Working</Button><Button type="button" variant="danger" disabled={busy} onClick={confirmEnd}>End Shift</Button></div>
    </dialog>
  </Card>;
}
function StatusDetail({ icon: Icon, label, value, description, wide }) {
  return <div className={wide ? "driver-info-box driver-info-box--wide" : "driver-info-box"}><Icon size={30} aria-hidden="true" /><div><dt>{label}</dt><dd>{value}</dd>{description && <p>{description}</p>}</div></div>;
}
