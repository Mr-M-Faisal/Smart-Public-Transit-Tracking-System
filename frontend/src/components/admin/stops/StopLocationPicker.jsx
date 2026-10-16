"use client";

import { Component, useEffect, useRef, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { Button } from "../../common/Button";
import { ClientTransitMap } from "../../map/MapShell";
import { MapViewport } from "../../map/MapShell";
import { selectedStopMapIcon } from "../../map/transitMarkerIcons";
import { LocationSearch } from "./LocationSearch";

const emptyPositions = [];

export function StopLocationPicker({ idPrefix, position, onChange, disabled }) {
  const [tileError, setTileError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [searchTarget, setSearchTarget] = useState(null);
  const searchSequence = useRef(0);
  function retryMap() { setTileError(false); setRetry((value) => value + 1); }
  function selectSearchResult(next) {
    onChange(next);
    searchSequence.current += 1;
    setSearchTarget({ position: next, sequence: searchSequence.current });
  }

  return <section aria-labelledby={idPrefix + "-location-title"} className="space-y-3">
    <div>
      <h3 id={idPrefix + "-location-title"} className="text-sm font-semibold">Select Stop Location</h3>
      <p id={idPrefix + "-location-help"} className="mt-1 text-sm leading-6 text-[var(--muted)]">Search for the general area, then click the map or drag the marker to select the exact roadside stop location.</p>
    </div>
    <LocationSearch idPrefix={idPrefix} disabled={disabled} onSelect={selectSearchResult} />
    {tileError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--warning-soft)] p-3 text-sm">
      <p className="text-[var(--danger)]">Map tiles could not be loaded. Check your connection and retry before choosing a location.</p>
      <Button type="button" variant="secondary" disabled={disabled} onClick={retryMap} className="min-h-11">Retry map</Button>
    </div>}
    <div className="relative h-72 overflow-hidden rounded-xl border border-[var(--border)] sm:h-80" aria-describedby={idPrefix + "-location-help"}>
      <LocationMapBoundary key={retry} onRetry={retryMap} disabled={disabled}>
        <ClientTransitMap center={position || undefined} zoom={position ? 17 : 13} className="h-full w-full !min-h-0" onTileError={() => setTileError(true)}>
          <MapViewport positions={emptyPositions} />
          <SearchMapFocus target={searchTarget} />
          <LocationSelection position={position} onChange={onChange} disabled={disabled || tileError} />
        </ClientTransitMap>
      </LocationMapBoundary>
      {disabled && <div className="absolute inset-0 z-[1000] cursor-wait bg-white/20" aria-hidden="true" />}
    </div>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={idPrefix + "-lat"} className="mb-1 block text-xs font-semibold">Latitude</label>
        <input id={idPrefix + "-lat"} type="text" readOnly value={position ? position[0].toFixed(6) : ""} className="field-input bg-[var(--background)] text-sm" placeholder="Select a point on the map" />
      </div>
      <div>
        <label htmlFor={idPrefix + "-lng"} className="mb-1 block text-xs font-semibold">Longitude</label>
        <input id={idPrefix + "-lng"} type="text" readOnly value={position ? position[1].toFixed(6) : ""} className="field-input bg-[var(--background)] text-sm" placeholder="Select a point on the map" />
      </div>
    </div>
    <p role="status" className="break-words text-sm text-[var(--muted)]">{position ? "Selected Location: " + position.map((value) => value.toFixed(6)).join(", ") : "No stop location selected yet."}</p>
  </section>;
}

function SearchMapFocus({ target }) {
  const map = useMap();

  useEffect(() => {
    if (target) map.flyTo(target.position, 17, { duration: 0.8 });
  }, [map, target]);
  return null;
}

function LocationSelection({ position, onChange, disabled }) {
  const map = useMapEvents({
    click(event) { if (!disabled) onChange([event.latlng.lat, event.latlng.lng]); },
  });
  const initialView = useRef({ center: position || map.getCenter(), zoom: map.getZoom() });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      map.setView(initialView.current.center, initialView.current.zoom, { animate: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [map]);
  if (!position) return null;

  return <Marker position={position} icon={selectedStopMapIcon} title="Selected stop location" zIndexOffset={200} riseOnHover draggable={!disabled} eventHandlers={{
    dragend(event) {
      if (disabled) return;
      const location = event.target.getLatLng();
      onChange([location.lat, location.lng]);
    },
  }}>
    <Popup><strong>Selected Stop Location</strong><p>Latitude: {position[0].toFixed(6)}<br />Longitude: {position[1].toFixed(6)}</p></Popup>
  </Marker>;
}

class LocationMapBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div role="alert" className="grid h-full content-center justify-items-center gap-3 bg-[var(--background)] p-4 text-center text-sm">
      <p>Unable to load the location map. Check your connection and retry. If it still fails, refresh the page.</p>
      <Button type="button" variant="secondary" onClick={this.props.onRetry} disabled={this.props.disabled} className="min-h-11">Retry map</Button>
    </div>;
    return this.props.children;
  }
}
