# Smart Safar - Phase 2: page rendering and dashboard optimization

Date: October 13, 2026. Phase 1 changes were preserved. Phase 3 was not started.

## 1. Confirmed rendering delays

- Nine page-wide next/dynamic wrappers disabled server rendering. Their fallback covered the whole page even though most of each page is ordinary React UI.
- Leaflet markers and controls import browser-dependent code as well as the map container. Removing only the outer wrappers without isolating these imports would break server rendering.
- AdminDashboardPage waited for getProfile(), seven independent data requests, and then one stop request per route before removing its page-level loading gate. Existing KPI/chart/report skeletons were hidden behind that gate.
- AppExperience and ProtectedPage each maintained a profile gate. getProfile() already shared/cached requests, but the extra page gate still caused a loading transition. No new authorization cache was needed.
- Notifications fetched the active route catalogue and then each route's alerts. Stop management also fetched stops once per route.
- There were no loading.js files and only the root layout. Page navigation had no route-segment skeleton boundary.
- The shared LoadingSpinner was already text-only, not a circular spinner. Its blocking containers and sparse placeholders were the remaining issue.

## 2. Wrappers removed and retained

Removed page-wide ssr:false dynamic imports from HomeRouteClient, LiveMapRouteClient, RouteDetailsRouteClient, BusDetailsRouteClient, AdminDashboardClient, BusManagementClient, StopManagementClient, RouteManagementClient and DriverDashboardClient. These modules now directly import their page components and retain use client.

Retained browser-only loading around TransitMap. Added narrow browser-only boundaries for Leaflet markers, polylines, viewport controls and the stop location picker. Parent pages and their navigation render without waiting for these modules. Road geometry and map internals are unchanged.

## 3. Dashboard requests before and after

Let R be the number of active routes. Counts below are data GET requests; they exclude CORS preflight and the existing session-profile request when uncached.

| Flow | Before | After |
| --- | --- | --- |
| Dashboard | 7 + R | 3 independent dashboard section requests |
| Administrator stop directory | 1 + R | 1 grouped-stop request |
| Notifications | R, plus catalogue request when uncached | 1 authenticated active-alert request |

The Chrome smoke check observed exactly three dashboard GET requests and no per-route stop requests. It deliberately held analytics while verifying that KPIs and fleet content had rendered with secondary skeletons still present.

Backend improvements:
- Overview bus counts use one grouped aggregation instead of four separate counts: five overview queries instead of eight overall.
- Transit fleet data is fetched once per dashboard request and reused to calculate occupancy. Route metadata is fetched once and reused for batched stops.
- Route stops use one assignment query, one physical-stop population and one legacy-stop query across all selected routes, rather than repeating this work per route.
- Report status/type summaries and the latest 20 reports use one facet aggregation; reporter population includes name only. Full report management remains available through the existing reports page.
- Independent sections return ready/data or error/message. A failed report, route or stop query does not discard unrelated successful sections. Query errors are not exposed to clients.
- Count/summary reads remain separate from secondary detail reads so KPI rendering does not wait for maps or charts. No cross-request authorization/data cache was added.

## 4. Endpoints introduced

- GET /api/admin/dashboard: existing admin middleware protects every variant. Optional section values: overview, analytics, transit, all (default). Invalid values return 400. Responses use private, no-store and a sections object.
- GET /api/stops/grouped: authenticated administrators only; returns active route metadata and ordered stops grouped by route. Reuses the read-only route-stop merge. Shared physical stops retain separate route memberships, and legacy rows are deduplicated per route/stop pair.
- GET /api/route-alerts/active: authenticated users; active routes only, nonexpired/no-expiry alerts, sorted newest first, stable alert IDs and route names. Existing public per-route alerts remain available.

No existing endpoint was removed. Phase 1 lightweight lists, explicit geometry access, compression, CORS and fresh backend authorization remain intact.

## 5. Loading and authentication behavior

- Dashboard header/navigation and static quick actions appear before data. KPI, fleet/map, booking chart, occupancy chart and report states settle independently. Each failed widget shows a local retry state instead of fake zero metrics or a blank dashboard.
- AppExperience shares its token-scoped profile with ProtectedPage. Backend middleware still reads current roles on each request; driver operations still force-refresh operational profile/shift state.
- During initial account verification a neutral, navigable shell appears; protected forms/data effects remain gated. Token changes abort dashboard requests and ignore outdated notification completions.
- Added loading.js boundaries for the root, admin, driver, routes, route details, bus details and live map. Added reusable page/section/map/row skeletons and reused detail skeletons.
- Bus details and driver screens use shaped placeholders; home uses card placeholders; local report/notification states use skeletons. Login/register suspense fallbacks no longer cover the screen with a loading animation.
- The live map remains usable while data loads, with a small status notice instead of a map-covering overlay. Offline status is initialized after hydration to avoid a server/client mismatch.
- No cinematic splash, theme CSS, service worker or GPS/seat business-rule files were changed.

## 6. Notifications

AppExperience and the commuter home's secondary alerts use the aggregated active-alert endpoint. Existing localStorage seen IDs, per-user ownership, ordering and mark-seen behavior remain. Responses for a previous token are ignored. There is no new persistent notification cache.

## 7. Phase 2 files changed

The working tree also contains the earlier uncommitted Phase 1 work; the inventory below describes Phase 2 only.

Backend:
- package.json (adds the new test file to npm test)
- src/controllers/adminController.js, dashboardController.js (new), routeAlertController.js, stopController.js
- src/routes/adminRoutes.js, routeAlertRoutes.js, stopRoutes.js
- src/services/dashboardService.js (new), routeStopService.js
- test/dashboard.test.js (new), driver-management.test.js
- scripts/check-phase2-browser.js (new)
- PHASE2_RENDERING_REPORT.md (new)

Frontend:
- All nine Client/RouteClient wrappers listed above
- components/admin/AdminDashboardPage.jsx, AdminMapWidget.jsx, AnalyticsSection.jsx, ReportsWidget.jsx
- components/admin/routes/RouteManagementPage.jsx, RoutePreviewModal.jsx
- components/admin/stops/StopManagementPage.jsx, AddStopModal.jsx, EditStopModal.jsx, StopLocationPicker.jsx
- components/booking/SeatSelectionPage.jsx (map import boundary only)
- components/bus/BusDetailsPage.jsx
- components/driver/DriverDashboardPage.jsx, DriverMap.jsx
- components/home/HomePage.jsx, CommuterHome.jsx
- components/live-map/LiveMapPage.jsx
- components/map/MapShell.jsx
- components/navigation/AppExperience.jsx
- components/route/RouteDetailsPage.jsx (map import boundary only)
- components/common/LoadingSpinner.jsx, ProtectedPage.jsx, SectionSkeleton.jsx (new), LoadingPageShell.jsx (new)
- hooks/useAuth.js, useProfileContext.js (new)
- services/adminService.js, alertService.js, stopService.js
- app/loading.js, admin/loading.js, driver/loading.js, live-map/loading.js, routes/loading.js, routes/[id]/loading.js, buses/[id]/loading.js (new)
- app/login/page.js, register/page.js

## 8. Tests

- Full backend npm test: 47 passed, zero failures/skips. Covers existing driver/shift/GPS, booking/payment/seat concurrency, Socket.IO and Phase 1 contracts plus new Phase 2 authorization, grouping, notifications and partial failures.
- After retaining the dashboard fleet's driver-name projection, the three focused dashboard tests passed again.
- Browser smoke check uses installed headless Chrome via its debugging protocol, without additional packages. It uses a uniquely named test database, removes only that database afterward, and starts its own frontend/backend processes. The already-running port-5000 backend is not stopped or modified. Browser HTTP traffic is intercepted into an ephemeral test backend; direct WebSocket upgrades to port 5000 are blocked, so this run uses Socket.IO polling. The regular integration suite separately covers real Socket.IO transports.
- Browser checks passed: Home -> Routes -> Route Details -> Live Map (with a rendered road polyline); Driver Home -> Shift -> Track -> Seats; Admin Dashboard -> Buses -> Routes -> Stops; exactly three dashboard GETs; no per-route dashboard stop requests; KPI/fleet rendering while analytics was held; preserved driver-name summary; aggregated notifications; commuter denied admin access; Blue initial theme and Orange restoration; zero captured runtime/hydration errors.

Run the optional browser script from backend with node scripts/check-phase2-browser.js after building frontend. It expects Chrome at the standard Windows path (or BROWSER_PATH), the existing frontend API origin http://localhost:5000, and free frontend port 3007. Temporary Chrome profiles remain in the OS temporary directory; generated JWTs belong only to the short-lived isolated test server.

## 9. Build and lint

Frontend npm run lint passed with no warnings. Frontend npm run build passed and generated all 29 pages, including the previously browser-only page shells. git diff --check passed. No new dependencies were added for Phase 2.

## 10. Remaining checks and risks

- Validate production-domain authentication/CORS, real-device GPS permissions and movement, mobile keyboard/focus behavior, and visual spacing on both themes under slow mobile networks.
- Offline snapshots and the service-worker implementation were preserved. Full installed-PWA/offline restart and update checks remain manual; the navigation automation bypasses service workers.
- Report lists on the dashboard intentionally show the latest 20; status/type totals cover all reports, and the full reports screen remains linked.
- Large-dataset load testing and latency percentiles were not measured in Phase 2. The measured request reduction is not a claim about production response-time percentiles.
- Deploy frontend and backend changes together so the new authenticated endpoints are available.

Stop after Phase 2. Phase 3 requires user approval.
