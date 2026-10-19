"use client";

import { BusFront } from "lucide-react";

import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";

/* --- Stop pin SVG -------------------------------------------------------- */
function StopPinSvg({ filled = false }) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M11 0C6.03 0 2 4.03 2 9c0 6.75 9 17 9 17s9-10.25 9-17c0-4.97-4.03-9-9-9z"
        fill={filled ? "currentColor" : "white"}
        stroke="currentColor"
        strokeWidth={filled ? "0" : "2"}
      />
      <circle cx="11" cy="9" r="3.5" fill={filled ? "white" : "currentColor"} />
    </svg>
  );
}

/* --- User location pulse icon (HTML string, not SVG) --------------------- */
function createUserPulseHtml() {
  return `
    <span class="transit-map-marker--user-pulse" aria-hidden="true">
      <span class="transit-map-marker--user-pulse-ring"></span>
      <span class="transit-map-marker--user-core"></span>
    </span>
  `;
}

/* --- Factory -------------------------------------------------------------- */
function createTransitIcon({ type, SvgComponent, iconSize, iconAnchor, popupAnchor }) {
  const html = renderToStaticMarkup(
    <span className={`transit-map-marker transit-map-marker--${type}`} aria-hidden="true">
      <SvgComponent />
    </span>,
  );
  return L.divIcon({ className: "transit-map-icon", html, iconSize, iconAnchor, popupAnchor });
}

export function createBusMapIcon({ heading = null, selected = false, stale = false } = {}) {
  return createTransitIcon({
    type: `bus${selected ? " bus--selected" : ""}${stale ? " bus--stale" : ""}`,
    SvgComponent: () => <><BusFront size={22} strokeWidth={2} /><span hidden={heading == null} className="transit-map-bus-rotation" style={{ transform: `rotate(${heading || 0}deg)` }}><span className="transit-map-heading-tip" /></span></>,
    iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20],
  });
}

export const busMapIcon = createBusMapIcon();

export const stopMapIcon = createTransitIcon({
  type: "stop",
  SvgComponent: () => <StopPinSvg filled={false} />,
  iconSize: [26, 30],
  iconAnchor: [13, 28],
  popupAnchor: [0, -28],
});

export const selectedStopMapIcon = createTransitIcon({
  type: "selected-stop",
  SvgComponent: () => <StopPinSvg filled={true} />,
  iconSize: [30, 35],
  iconAnchor: [15, 33],
  popupAnchor: [0, -33],
});

export const nextStopMapIcon = createTransitIcon({
  type: "next-stop",
  SvgComponent: () => <StopPinSvg filled />,
  iconSize: [32, 37], iconAnchor: [16, 35], popupAnchor: [0, -35],
});

export const userMapIcon = L.divIcon({
  className: "transit-map-icon",
  html: createUserPulseHtml(),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -22],
});

export const passengerMapIcon = createTransitIcon({
  type: "passenger",
  SvgComponent: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="10" cy="6" r="4" fill="currentColor" />
      <path d="M2 18c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});
