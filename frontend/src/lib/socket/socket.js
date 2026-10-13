import { io } from "socket.io-client";
import { SOCKET_URL } from "../../config/api";

let socket;
let consumers = 0;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL || undefined, { autoConnect: false });
    const watchedBuses = new Set();
    socket.onAnyOutgoing((event, busId) => { if (event === "watchBus" && busId) watchedBuses.add(String(busId)); });
    socket.on("connect", () => watchedBuses.forEach((id) => socket.emit("watchBus", id)));
  }
  return socket;
}

export function connectSocket() {
  consumers += 1;
  const client = getSocket();
  if (!client.connected) client.connect();
  return client;
}

export function disconnectSocket() {
  consumers = Math.max(0, consumers - 1);
  if (consumers === 0) socket?.disconnect();
}

export function subscribeToSocketEvent(event, handler) {
  const client = connectSocket();
  client.on(event, handler);
  return () => {
    client.off(event, handler);
    disconnectSocket();
  };
}

export function watchBus(busId) {
  getSocket().emit("watchBus", busId);
}
