# Phase 3 ? Shared cache, offline loading and network resilience

Date: October 13, 2026. Scope: Phase 3 only. Phase 1/2 work remains in the shared working tree; no Phase 4 GPS transmission changes or backend business-rule changes.

1. **Confirmed issues.** Route/stop services had separate indefinite caches. Full geometry bypassed the route cache, and Live Map invalidated it on every entry. Routes hid restored data behind a loading flag. Route and bus details waited for secondary requests. Home relied on a different saved map snapshot. Axios had no default timeout. Navigation could release the last socket consumer and disconnect. Worker cache-first API responses could look fresh to a second client cache. The Clock Tower JPEG was 871,263 bytes.

2. **Query choice.** Added @tanstack/react-query 5.104.2. Its shared client, query observers, cancellation and mutation invalidation suit the existing imperative service API and React pages. One root TransitProvider owns the browser QueryClient; server rendering gets isolated clients. No separate persistence plugin/database was added. Installed Next.js client-provider guidance was read before editing.

3. **Queries.** Routes and route stops: 60 seconds. Full geometry and route details: 15 minutes. Bus summaries: 15 seconds. Bus details/ETA: 10 seconds. Active alerts: 15 seconds, account-scoped in memory. Additional public per-route alert and bus metadata queries share the same client. Seat-selection and driver imperative bus-detail reads explicitly require a fresh request. No polling was added. Pages independently observe reference and operational queries; hydrated memory data renders on navigation, while IndexedDB restores cold launches before network work. A per-subtree hydration guard prevents saved data from changing streamed server HTML before hydration completes.

4. **Invalidation.** Successful route/stop mutations cancel older matching requests, invalidate route lists/details/geometry/stops, update persistence, and refresh active observers. Bus mutations invalidate summaries/details/metadata. Alert mutations invalidate aggregated and route alerts. Live Map no longer invalidates on entry or refetches all data on every visibility change. Account changes remove in-memory aggregated alerts and reset private socket rooms. Backend roles and assignments remain authoritative.

5. **IndexedDB.** Reused smart-safar-live-map version 1, snapshots store, with a public-queries-v1 record. It retains query timestamps and at most 150 reference entries. Existing route catalogue and stable map references migrate without persisting saved GPS as new query data. Only routes, stops, geometry and basic bus metadata are allowed. Seats, current GPS, ETAs, driver contacts, profiles, JWTs, bookings and passenger locations are excluded. Existing account-scoped snapshots and the idempotent offline booking queue are unchanged. GPS/seat socket events update memory without rewriting persisted geometry.

6. **Offline pages.** Previously visited Home, Routes, Route Details with stops/road geometry, Live Map references and basic bus details support offline document reload. Unvisited detail documents or unsaved routes still need an initial online visit. Offline map tiles are not downloaded/cached, so the map background can be unavailable while saved lines/stops render. Cache timestamps and saved/offline/refresh status are visible, with retry actions. Operational values are withheld or labelled last known when stale/disconnected; offline bus metadata cannot authorize booking or supply seats.

7. **Timeouts/retries.** Axios defaults to 15 seconds; GPS location PATCH uses 8 seconds without changing its transmission cadence. Transient GET network errors and 502/503/504 receive at most one retry after 500?750 ms jittered delay. Cancellation, offline state, auth errors and all mutations are excluded. Query-level retries are disabled, avoiding compounded retry loops. Worst-case general GET waiting is approximately 30.75 seconds, excluding browser scheduling. Existing explicit idempotent booking-queue retries are preserved.

8. **Data Saver.** Automatic/On/Off preference persists locally. Automatic uses saveData or slow-2g/2g/3g hints when supported; unsupported browsers default to normal behavior. Control is in the public footer and authenticated profile menu. Saver mode avoids decorative image components/CSS backgrounds, disables opportunistic Next Link prefetch and extra idle shell warming, reduces map tile buffering/zoom fetching and home reveal animation. Visiting a page still warms its offline document. Driver GPS, safety and seat updates retain their behavior. Splash markup, timing, artwork and animation CSS are unchanged.

9. **Images.** Existing Clock Tower photo converted with the installed Sharp codec: desktop 1200 px WebP = 88,892 bytes; mobile 480 px WebP = 21,162 bytes. CSS selects the mobile file below 640 px. Savings against the original JPEG are approximately 89.8% and 97.6%. The source JPEG is retained but has no application references; no unrelated images were deleted.

10. **Service worker.** Shell version advances to v10; old Smart Safar cache versions are removed during activation. The worker handles same-origin public documents, RSC responses and static assets. API and cross-origin responses bypass worker storage; the IndexedDB client layer works even when the API is on another origin. Private data, mutations, live sockets and map tiles remain outside worker caches. Cached shell registration, cold start and offline public-document navigation are preserved.

11. **Socket lifecycle.** The root provider holds one existing Socket.IO connection across client navigation. Existing component listeners still clean up. Cached fleet IDs join public bus rooms; reconnect replays watched IDs. Location/seat events update in-memory fleet/detail queries. Account changes deliberately reconnect to drop private rooms. Existing watchDriverBookings/unwatchDriverBookings cleanup remains intact. Default polling/WebSocket transport negotiation was retained.

12. **Measurements.** Production Chrome test uses an isolated real MongoDB database and ephemeral backend, with HTTP redirected from the configured API origin. Returning Routes ? Home ? Routes generated zero additional route-list GETs and kept the same socket. Test-observed return times varied roughly 19?174 ms across completed runs; the harness polls and these are not paint or production-network benchmarks. No pre-Phase-3 page-timing baseline was captured, so no timing speedup is claimed. Home decorative-image transfer with HTTP cache disabled and worker bypassed measured 364,340 bytes with Saver Off (including direct CSS image requests and Next Image requests) and 0 with Saver On at the same viewport. These are image-transfer bytes, not total page weight. API response-size contracts from Phase 1 are unchanged.

13. **Files changed for Phase 3.** No backend runtime source was changed. Added backend/scripts/check-phase3-browser.js. Frontend core files:

- package.json, package-lock.json
- src/app/layout.js, src/app/globals.css
- src/lib/query/transitQueries.js, src/lib/api/axios.js, src/lib/live-map/liveMapStorage.js, src/lib/socket/socket.js
- src/components/providers/TransitProvider.jsx
- src/hooks/useTransitQuery.js, src/hooks/useDataSaver.js
- src/components/common/CacheStatus.jsx, DataSaverControl.jsx, SmartLink.jsx, CardBackdrop.jsx
- src/components/home/HomePage.jsx, CommuterHome.jsx
- src/components/routes/RoutesPage.jsx, src/components/route/RouteDetailsPage.jsx
- src/components/bus/BusDetailsPage.jsx, BusCard.jsx
- src/components/live-map/LiveMapPage.jsx, src/components/booking/BookingPage.jsx
- src/components/map/TransitMap.jsx
- src/components/navigation/AppExperience.jsx, Footer.jsx
- src/components/pwa/PwaSupport.jsx, public/service-worker.js
- src/services/routeService.js, stopService.js, busService.js, alertService.js
- public/faisalabad-clocktower.webp, public/faisalabad-clocktower-mobile.webp
- test/phase3-cache.test.cjs and this report

The following consumers also use the shared SmartLink import to respect Data Saver prefetch; many have no other Phase 3 change:

- frontend/src/components/admin/AdminMapWidget.jsx
- frontend/src/components/admin/buses/BusManagementPage.jsx
- frontend/src/components/admin/buses/BusTable.jsx
- frontend/src/components/admin/buses/DriverAssignmentModal.jsx
- frontend/src/components/admin/LiveTransitPanel.jsx
- frontend/src/components/admin/QuickActions.jsx
- frontend/src/components/admin/ReportsWidget.jsx
- frontend/src/components/admin/routes/RouteManagementPage.jsx
- frontend/src/components/admin/routes/RoutePreviewModal.jsx
- frontend/src/components/admin/routes/RouteTable.jsx
- frontend/src/components/admin/stops/StopManagementPage.jsx
- frontend/src/components/admin/users/DriverManagementPage.jsx
- frontend/src/components/auth/LoginPage.jsx
- frontend/src/components/auth/RegisterPage.jsx
- frontend/src/components/booking/ConfirmationPage.jsx
- frontend/src/components/booking/MyTripsPage.jsx
- frontend/src/components/booking/SeatSelectionPage.jsx
- frontend/src/components/bus/BusCard.jsx
- frontend/src/components/bus/BusDetailsPage.jsx
- frontend/src/components/common/ProtectedPage.jsx
- frontend/src/components/driver/DriverDashboardPage.jsx
- frontend/src/components/driver/DriverRouteCard.jsx
- frontend/src/components/home/CommuterHome.jsx
- frontend/src/components/home/HomePage.jsx
- frontend/src/components/map/BusDetailsPanel.jsx
- frontend/src/components/map/MapControls.jsx
- frontend/src/components/map/StopDetailsPanel.jsx
- frontend/src/components/navigation/AppExperience.jsx
- frontend/src/components/navigation/Footer.jsx
- frontend/src/components/navigation/Navbar.jsx
- frontend/src/components/route/RouteCard.jsx
- frontend/src/components/route/RouteDetailsPage.jsx

14. **Validation.** Backend npm test: 47/47 passed. Frontend npm run test:cache: 4/4 passed (Node VM-module experimental flag is used only by the test loader). Frontend lint: zero errors/warnings. Frontend production build: passed, 29 static pages generated. git diff --check: passed. Phase 2 production Chrome compatibility script passed public route/map navigation, Driver Home ? Shift ? Track ? Seats, Admin Dashboard ? Buses ? Routes ? Stops, aggregated notifications, commuter admin denial, and theme restoration. Phase 3 Chrome suite passed cached navigation/socket continuity, offline full-document reloads, stops/road geometry, safe IndexedDB contents, no API data in worker caches, silent reconnect, Saver transfer measurement, and a real admin form network failure with exactly one POST/no inserted record. Final successful browser runs had no captured runtime/hydration errors. Earlier hydration and reload-test timing failures were corrected and rerun.

15. **Limitations/manual checks.** Desktop headless Chrome was tested; an installed Android PWA, iOS Safari, physical low-end phones and actual Pakistani mobile-network transitions were not tested. Check those devices for offline launch after browser eviction, image selection at mobile widths, storage-denied behavior, and physical GPS/seat workflows. No new offline tile support is implied. Existing dependency installation reported 8 audit advisories (7 high, 1 critical); broad dependency remediation was outside this phase. No deployment or production database mutation was performed. Phase 4 has not started.
