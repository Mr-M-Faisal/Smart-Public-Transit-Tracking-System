"use client";

import Link from "../common/SmartLink";
import { ArrowLeft, LocateFixed, Maximize2, Plus, Minus, ScanSearch, Navigation } from "lucide-react";
import { useMap } from "react-leaflet";
import { Button } from "../common/Button";

export function MapControls({ onLocate, onShowAll, onToggleFollow, followActive = false, followDisabled = false }) {
  const map = useMap();
  const toggleFullscreen = () => {
    const container = map.getContainer();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else container.requestFullscreen?.().catch(() => {});
  };
  return <div className="absolute right-3 top-3 z-[400] grid gap-2"><Link href="/" title="Back to home" aria-label="Back to home" className="map-control-button grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--primary-ink)] shadow-md"><ArrowLeft size={18} /></Link><Button title="Zoom in" aria-label="Zoom in" className="map-control-button !h-11 !min-h-11 !w-11 !p-0" onClick={() => { if (followActive) onToggleFollow?.(); map.zoomIn(); }}><Plus size={18} /></Button><Button title="Zoom out" aria-label="Zoom out" variant="secondary" className="map-control-button !h-11 !min-h-11 !w-11 !p-0" onClick={() => { if (followActive) onToggleFollow?.(); map.zoomOut(); }}><Minus size={18} /></Button>{onToggleFollow && <Button title={followActive ? "Stop following bus" : "Follow selected bus (north-up)"} aria-label={followActive ? "Stop following bus" : "Follow selected bus (north-up)"} aria-pressed={followActive} variant={followActive ? "primary" : "secondary"} disabled={followDisabled} className="map-control-button !h-11 !min-h-11 !w-11 !p-0" onClick={onToggleFollow}><Navigation size={17} /></Button>}{onShowAll && <Button title="Show transit network" aria-label="Show transit network" variant="secondary" className="map-control-button !h-11 !min-h-11 !w-11 !p-0" onClick={() => onShowAll(map)}><ScanSearch size={17} /></Button>}{onLocate && <Button title="Use my location" aria-label="Use my location" variant="secondary" className="map-control-button !h-11 !min-h-11 !w-11 !p-0" onClick={() => onLocate(map)}><LocateFixed size={18} /></Button>}<Button title="Toggle full screen map" aria-label="Toggle full screen map" variant="secondary" className="map-control-button !h-11 !min-h-11 !w-11 !p-0" onClick={toggleFullscreen}><Maximize2 size={17} /></Button></div>;
}
