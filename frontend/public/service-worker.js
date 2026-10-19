/* Public shell and public transit snapshots only. Private sessions, bookings,
   live sockets, map tiles, and mutations are deliberately never cached. */
const SHELL_CACHE = "smart-safar-shell-v12";
const TRANSIT_CACHE = "smart-safar-transit-v8";
const STATIC_ASSETS = [
  "/",
  "/routes",
  "/live-map",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/brand-128-v2.png",
  "/smart-safar-launch-bus.svg",
  "/icons/app-192-v2.png",
  "/icons/maskable-512-v2.png",
  "/icons/favicon-32-v2.png",
  "/icons/app-512-v2.png",
  "/icons/apple-180-v2.png",
];

function isPublicPage(url) {
  return url.pathname === "/"
    || url.pathname === "/live-map"
    || url.pathname === "/routes"
    || /^\/routes\/[^/]+$/.test(url.pathname)
    || /^\/buses\/[^/]+$/.test(url.pathname)
    || url.pathname === "/login"
    || url.pathname === "/register";
}

function isFlightRequest(request, url) {
  return request.headers.has("RSC")
    || request.headers.has("Next-Router-State-Tree")
    || url.searchParams.has("_rsc");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("smart-safar-") && ![SHELL_CACHE, TRANSIT_CACHE].includes(name)).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});

function isStaticAsset(url) {
  return url.origin === self.location.origin && (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/"));
}

function normalizedCacheRequest(request) {
  const url = new URL(request.url);
  if (isFlightRequest(request, url)) {
    // The cache key includes the router context: never replay a partial Flight
    // response into a different route tree or confuse it with an HTML document.
    url.searchParams.delete("_rsc");
    url.searchParams.set("__safar_flight", JSON.stringify([
      request.headers.get("Next-Router-State-Tree"),
      request.headers.get("Next-Router-Prefetch"),
      request.headers.get("Next-Router-Segment-Prefetch"),
      request.headers.get("Next-Url"),
    ]));
  }
  return new Request(url.toString(), { method: "GET", headers: request.headers });
}

async function cacheFirst(request, cacheName, fallback) {
  const cacheKey = normalizedCacheRequest(request);
  const cache = await caches.open(cacheName);
  const cached = await cache.match(cacheKey);
  const refresh = fetch(request).then((response) => {
    if (response?.ok && response.type !== "opaque") cache.put(cacheKey, response.clone());
    return response;
  });
  if (cached) {
    // Revalidate quietly; a cold offline launch never waits on a connection.
    refresh.catch(() => null);
    return cached;
  }
  return refresh.catch(async () => fallback || (await caches.match("/offline.html")) || new Response("Offline", { status: 503, statusText: "Offline" }));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // IndexedDB-backed queries own API persistence, including cross-origin APIs.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (isFlightRequest(request, url)) {
    if (isPublicPage(url)) event.respondWith(cacheFirst(request, SHELL_CACHE, new Response("", { status: 503, statusText: "Offline" })));
    return;
  }
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  if ((request.mode === "navigate" || acceptsHtml) && url.origin === self.location.origin) {
    event.respondWith(isPublicPage(url) ? cacheFirst(request, SHELL_CACHE) : fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (isStaticAsset(url)) event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response?.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
