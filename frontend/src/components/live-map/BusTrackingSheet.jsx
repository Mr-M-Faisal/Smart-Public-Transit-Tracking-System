"use client";
import { useRef, useState } from "react";
import { ChevronUp, X, Navigation, ArrowRight } from "lucide-react";
import Link from "../common/SmartLink";
import { trackingStatus } from "../../lib/live-map/trackingStatus";

export function BusTrackingSheet({ bus, now, online, followActive, onToggleFollow, onClose, hiddenByFilters }) {
  const [expanded, setExpanded] = useState(false);
  const start = useRef(null);
  const dragged = useRef(false);
  const status = trackingStatus(bus, now, online);
  const timestamp = Date.parse(bus.lastLocationUpdate || "");
  const rows = [
    ["Direction", bus.directionLabel],
    ["Last update", Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : null],
    ["Next stop", typeof bus.nextStop === "string" ? bus.nextStop : null],
    ["ETA", status.canFollow ? bus.eta : null],
  ].filter(([, value]) => value);
  return <section className="bus-tracking-sheet" data-expanded={expanded} aria-label="Selected bus details">
    <div className="bus-sheet-heading">
      <button type="button" className="bus-sheet-toggle" aria-expanded={expanded} aria-controls="bus-sheet-content"
        onClick={() => { if (dragged.current) { dragged.current = false; return; } setExpanded(value => !value); }}
        onPointerDown={event => { dragged.current = false; start.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={event => { const delta = event.clientY - start.current; start.current = null; if (Math.abs(delta) > 35) { dragged.current = true; setExpanded(delta < 0); } }}
        onPointerCancel={() => { start.current = null; }}>
        <span><strong>{bus.number || bus.busNumber}</strong><span>{bus.routeName}</span><small>{status.label}</small></span>
        <ChevronUp size={18} className={expanded ? "rotate-180" : ""} aria-hidden="true" />
      </button>
      <button type="button" className="bus-sheet-close" aria-label="Close bus details" onClick={onClose}><X size={18} /></button>
    </div>
    <div id="bus-sheet-content" className="bus-sheet-content">
      {status.explanation && <p role="status">{status.explanation}</p>}
      {hiddenByFilters && <p>Hidden by current filters.</p>}
      <dl>{rows.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <button type="button" className="bus-sheet-follow" disabled={!followActive && !status.canFollow} onClick={onToggleFollow}><Navigation size={16} />{followActive ? "Stop following bus" : "Follow bus"}</button>
      {!status.canFollow && <p className="bus-sheet-hint">Follow requires a fresh, usable GPS location.</p>}
      <Link href={`/buses/${bus.id}`} className="bus-sheet-link">View Bus Details <ArrowRight size={16} /></Link>
    </div>
  </section>;
}
