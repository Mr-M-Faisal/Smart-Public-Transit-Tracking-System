"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import { createBusMapIcon } from "./transitMarkerIcons";
import { freshMapFix, nextMapHeading } from "../../lib/transit/mapHeading";

function BusMarkerView({ position, bus, onSelect, selected = false, stale = false }) {
  const markerRef = useRef(null);
  const history = useRef(null);
  const identity = useRef(null);
  const icon = useMemo(() => createBusMapIcon(), []);
  const label = bus?.name || bus?.number || bus?.busNumber || "Bus";
  useEffect(() => {
    const id = bus?.id || bus?._id || bus?.busId;
    if (identity.current !== id) { history.current = null; identity.current = id; }
    const update = () => {
      const unavailable = stale || bus?.isSaved || bus?.status !== "active" ||
        !freshMapFix(position, bus?.lastLocationUpdate);
      history.current = nextMapHeading(history.current, {
        position, timestamp: bus?.lastLocationUpdate, heading: bus?.heading,
        accuracy: bus?.accuracy, speed: bus?.speed, stale: unavailable,
      });
      const element = markerRef.current?.getElement();
      const symbol = element?.querySelector(".transit-map-marker");
      const arrow = element?.querySelector(".transit-map-bus-rotation");
      symbol?.classList.toggle("bus--selected", selected);
      symbol?.classList.toggle("bus--stale", Boolean(unavailable));
      if (arrow) {
        arrow.hidden = unavailable || history.current?.heading == null;
        arrow.style.transitionDuration = navigator.connection?.saveData ? "0ms" : "";
        arrow.style.transform = `rotate(${history.current?.rotation || 0}deg)`;
      }
      const description = unavailable ? "Location update delayed; direction unavailable" :
        history.current?.heading == null ? "Direction unavailable" : "Direction of travel";
      if (element) element.title = `${label}: ${description}`;
    };
    update();
    const timer = setInterval(update, 15000);
    return () => clearInterval(timer);
  }, [position, bus, selected, stale, label]);
  if (!position) return null;
  return <Marker ref={markerRef} position={position} title={label} icon={icon} zIndexOffset={selected ? 450 : 300} riseOnHover eventHandlers={{ click: () => onSelect?.(bus) }}><Popup><strong>{label}</strong><p className="mt-1">Map remains north-up. Direction appears when reliable GPS is available.</p></Popup></Marker>;
}
export const BusMarker = memo(BusMarkerView, (before, after) =>
  before.selected === after.selected && before.stale === after.stale && before.onSelect === after.onSelect &&
  before.position?.[0] === after.position?.[0] && before.position?.[1] === after.position?.[1] &&
  ["id", "_id", "busId", "name", "number", "busNumber", "isSaved", "status", "lastLocationUpdate", "heading", "accuracy", "speed"].every(key => before.bus?.[key] === after.bus?.[key])
);
