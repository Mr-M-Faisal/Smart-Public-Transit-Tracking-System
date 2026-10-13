"use client";

import { useDataSaver } from "../../hooks/useDataSaver";
import "leaflet/dist/leaflet.css";
import { MapContainer as LeafletMap, TileLayer } from "react-leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function TransitMap({ center = [31.4187, 73.0791], zoom = 12, children, className = "", onReady, onLoad, onTileError }) {
  const { enabled } = useDataSaver();
  return <LeafletMap center={center} zoom={zoom} className={className} scrollWheelZoom>
    <TileLayer keepBuffer={enabled ? 0 : 2} updateWhenIdle={enabled} updateWhenZooming={!enabled} attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={onTileError ? { tileerror: onTileError } : undefined} />
    {(onReady || onLoad) && <MapReady onReady={onReady || onLoad} />}
    {children}
  </LeafletMap>;
}

function MapReady({ onReady }) {
  const map = useMap();

  useEffect(() => onReady(map), [map, onReady]);
  return null;
}
