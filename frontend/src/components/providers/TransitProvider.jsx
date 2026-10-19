"use client";
import { createContext, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient, restoreQueries, persistQueries, isPublicQuery } from "../../lib/query/transitQueries";
import { AUTH_CHANGE_EVENT, getAccessToken } from "../../lib/auth/token";
import { connectSocket, disconnectSocket } from "../../lib/socket/socket";
import { mergeTelemetry } from "../../lib/transit/liveTelemetry";
export const LiveConnectionContext = createContext(false);
export const CacheReadyContext = createContext(false);
export function TransitProvider({ children }) {
  const [client] = useState(getQueryClient);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    let timer;
    let restored = false;
    restoreQueries().then(() => { restored = true; if (active) setReady(true); });
    const socket = connectSocket();
    const markConnected = () => setConnected(true);
    const markDisconnected = () => setConnected(false);
    socket.on("connect", markConnected);
    socket.on("disconnect", markDisconnected);
    socket.on("connect_error", markDisconnected);
    if (socket.connected) markConnected();
    const watched = new Set();
    const watchQueries = () => {
      for (const query of client.getQueryCache().findAll()) {
        const kind = query.queryKey[1];
        if (!["bus", "buses"].includes(kind) || !query.state.data) continue;
        for (const bus of (kind === "bus" ? [query.state.data] : query.state.data)) {
          if (!watched.has(bus._id)) { watched.add(bus._id); socket.emit("watchBus", bus._id); }
        }
      }
    };
    const rewatch = () => { watched.clear(); watchQueries(); };
    socket.on("connect", rewatch);
    const updateBus = (update) => {
      const id = String(update?.busId || update?._id || update?.id || "");
      if (!id) return;
      const merge = (bus) => {
        if (String(bus._id) !== id) return bus;
        const merged = mergeTelemetry(bus, update);
        return merged === bus ? bus : { ...merged, ...(update.latitude != null ? { currentLocation: { latitude: update.latitude, longitude: update.longitude } } : {}) };
      };
      client.setQueriesData({ queryKey: ["transit", "buses"] }, (data) => data?.map(merge));
      client.setQueryData(["transit", "bus", id], (data) => data ? merge(data) : undefined);
    };
    const events = ["locationUpdate", "busLocation", "busUpdate", "occupancyUpdate", "seatMapUpdate"];
    events.forEach((event) => socket.on(event, updateBus));
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (["bus", "buses"].includes(event.query?.queryKey[1]) && event.type === "updated") watchQueries();
      // GPS/seat events update memory only, never rewrite the geometry snapshot.
      if (!restored || !isPublicQuery(event.query) || !["updated", "removed"].includes(event.type)) return;
      clearTimeout(timer);
      timer = setTimeout(persistQueries, 100);
    });
    let previousToken = getAccessToken();
    const clearPrivate = () => {
      const token = getAccessToken();
      if (token === previousToken) return;
      previousToken = token;
      client.removeQueries({ predicate: (q) => q.queryKey[1] === "alerts" });
      // Account changes, unlike page navigation, deliberately reset private rooms.
      socket.disconnect().connect();
    };
    const reconnect = () => client.refetchQueries({ type: "active", stale: true });
    window.addEventListener(AUTH_CHANGE_EVENT, clearPrivate);
    window.addEventListener("storage", clearPrivate);
    window.addEventListener("online", reconnect);
    // Own the connection for the app lifetime. Page listeners still clean up.
    watchQueries();
    return () => { active = false; socket.off("connect", rewatch); socket.off("connect", markConnected); socket.off("disconnect", markDisconnected); socket.off("connect_error", markDisconnected); clearTimeout(timer); unsubscribe(); events.forEach((event) => socket.off(event, updateBus)); disconnectSocket(); window.removeEventListener(AUTH_CHANGE_EVENT, clearPrivate); window.removeEventListener("storage", clearPrivate); window.removeEventListener("online", reconnect); };
  }, [client]);
  return <QueryClientProvider client={client}><CacheReadyContext.Provider value={ready}><LiveConnectionContext.Provider value={connected}>{children}</LiveConnectionContext.Provider></CacheReadyContext.Provider></QueryClientProvider>;
}
