"use client";

import { useEffect, useState } from "react";
import { subscribeToSocketEvent } from "../lib/socket/socket";

import { mergeTelemetry } from "../lib/transit/liveTelemetry";

const LIVE_EVENTS = ["locationUpdate", "busLocation", "busUpdate", "etaUpdate", "occupancyUpdate"];

export function useLiveBuses(initialBuses = []) {
  const [buses, setBuses] = useState(initialBuses);

  useEffect(() => {
    const cleanups = LIVE_EVENTS.map((event) => subscribeToSocketEvent(event, (update) => {
      if (!update?.id && !update?._id && !update?.busId) return;
      setBuses((current) => {
        const id = update.id || update._id || update.busId;
        const existing = current.findIndex((bus) => (bus.id || bus._id || bus.busId) === id);
        if (existing < 0) return [...current, update];
        return current.map((bus, index) => (index === existing ? mergeTelemetry(bus, update) : bus));
      });
    }));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return buses;
}
