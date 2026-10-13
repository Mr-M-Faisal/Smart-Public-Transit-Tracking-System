# Smart Safar ? Phase 1 performance report

October 13, 2026. Scope: Backend Performance Quick Wins and essential frontend compatibility only. The separately named plan was unavailable; the user explicitly authorized proceeding from the detailed prompt. Phases 2?6 were not started.

## Confirmed causes and existing improvements

- Express had no response compression. Express CORS allowed arbitrary origins; Socket.IO used a wildcard.
- Active route lists hydrated and serialized complete outbound/return road geometry. Bus lists hydrated and serialized every individual seat and recent speed samples.
- Protected requests loaded complete user records except passwords, although consumers only use _id, role and assignedBus. Profile mutation handlers independently load a document before saving.
- Already implemented: browser-session route catalogue caching/request sharing; stored road geometry; public seat serialization removing booking references; seat summary counters; detail endpoints; live seat/GPS events; offline map snapshots; database-backed assignment and shift checks.
- Existing indexes already cover bus route lookup, user email/Google identity, booking user history/bus status/route status, ordered route stops, and active-shift uniqueness. These were preserved.

## Measured response sizes and timings

Real configured MongoDB data, read-only queries, local HTTP server. Original controllers from baseline commit 22deed35f23b61f7e66457c8c0e7dc21dea2a2a2 were compared with current handlers. One warm-up and three sequential measured requests per variant; bytes are HTTP response body bytes, excluding headers. No production records or indexes were changed by measurement. MongoDB autoIndex was disabled. Initial standalone connection checks failed; the application's existing DNS configuration made the database reachable.

| Endpoint | Before bytes | After identity bytes | After gzip bytes | Before median ms | After identity median ms | After gzip median ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| /api/routes | 1,652 | 1,177 | 384 | 116.91 | 123.34 | 116.69 |
| /api/buses | 11,555 | 1,773 | 637 | 365.07 | 256.56 | 239.58 |

Uncompressed reductions: routes 28.8%, buses 84.7%. Gzipped responses versus original uncompressed responses: routes 76.8%, buses 94.5%. The timing sample is small and includes remote database/network variation; route latency did not materially improve. This is not a load test or evidence of index speedup. Run node scripts/measure-phase1.js from backend to repeat the read-only comparison; the historical commit must be available locally.

## Implemented contracts

- compression middleware uses normal MIME filtering, a 1 KiB threshold, encoding negotiation, and protections for already encoded and no-transform responses.
- GET /api/routes remains an array with IDs, names, endpoints, descriptions, status and timestamps. Default queries exclude geometry at the database and use lean(). GET /api/routes/:id retains full geometry. GET /api/routes?includeGeometry=true explicitly supplies outbound/return geometry to the all-routes live map.
- GET /api/buses remains an array and retains route/driver summaries, capacities, available seats, seat sections, location, direction, status and trust information. seatMap and recentSpeeds are excluded at the database; list queries use lean(). GET /api/buses/:id still returns sanitized individual seats. Seat mutations, booking transactions and Socket.IO payloads are unchanged.
- The live map explicitly requests geometry and still saves full offline snapshots. Passenger seats, driver seats, bus details and route details already use detail endpoints. The admin editor now loads full bus details, with loading/retry behavior, before mounting its editable form.
- Protected requests project _id, role and assignedBus with lean(), re-reading on every request. No role/assignment cache was added.

## Index audit

All ten schema definitions and live collection indexes were inspected with autoIndex disabled. Only these missing, non-unique schema indexes were added:

| Model | Index | Query justification |
| --- | --- | --- |
| Route | isActive:1, createdAt:-1 | Active route catalogue filter/sort |
| Bus | driver:1 | Assignment conflict detection and driver deletion |
| Booking | createdAt:-1 | Dashboard daily counts and date-range analytics |
| Report | createdAt:-1 | Unfiltered report chronological list |
| Report | status:1, createdAt:-1 | Status-filtered report list and open-report counts |
| User | role:1, name:1, _id:1 | Administrator driver directory filter/sort |

Booking uniqueness and shift uniqueness rules were unchanged. No syncIndexes or index removal was run. The live database already has a legacy Stop route/stopOrder index; it was left intact. Existing Booking user/idempotencyKey uniqueness is declared in the schema but was absent from the inspected live database; this pre-existing drift was left untouched as requested. New indexes were exercised through model initialization in isolated integration-test databases; live rollout still needs index verification.

## CORS deployment configuration

Set backend CORS_ORIGINS to a comma-separated list of the exact real frontend origins, including scheme and port where applicable. FRONTEND_URL is accepted as a fallback when CORS_ORIGINS is unset. No deployed domain was available in the repository or supplied during implementation, so none was guessed.

Outside production, http://localhost:3000 and http://127.0.0.1:3000 are also allowed. Additional development ports can be explicitly configured. Production only allows configured origins; with none configured, browser cross-origin requests fail closed. Requests without Origin remain supported for native/server clients and still require normal authentication on private endpoints. Express preflights support Authorization and credentials. Socket.IO applies the same policy to polling and WebSocket handshakes.

## Changed files

Backend:
- package.json and package-lock.json
- src/server.js
- src/config/cors.js
- src/controllers/routeController.js
- src/controllers/busController.js
- src/middleware/auth.js
- src/models/Route.js, Bus.js, Booking.js, Report.js and User.js
- test/performance.test.js and test/seat-management.test.js
- scripts/measure-phase1.js
- PHASE1_PERFORMANCE_REPORT.md

Frontend:
- src/services/routeService.js
- src/components/live-map/LiveMapPage.jsx
- src/components/admin/buses/EditBusModal.jsx

seatService.js was audited and retained unchanged. No splash animation or offline implementation files changed.

## Verification

Backend npm test passed: 41 tests, zero failures, zero skipped (180.3 seconds). Frontend npm run lint and npm run build passed; Next.js generated all 29 pages. Initial sandbox subprocess/build-output denials were resolved by rerunning with the required execution permission. Focused tests cover compression, no double compression, exact origins, preflight credentials, both Socket.IO transports, list/detail contracts, and immediate authorization changes. Existing integration tests use random isolated databases and clean them up. git diff --check passed.

## Remaining risks and manual checks

- Configure real deployed frontend origins before rollout and test login, authenticated requests, Socket.IO polling and WebSocket connectivity from each origin.
- Deploy frontend compatibility updates with the backend; old cached frontend bundles may still expect list geometry or seat maps.
- In a browser, open route and bus detail pages; inspect outbound/return Leaflet road polylines, offline map restoration, passenger seat selection, admin layout editing, online booking, driver walk-in occupancy, shift transitions and GPS updates. API/build checks do not substitute for visual/device verification.
- Verify new live database indexes after deployment; investigate existing idempotency-index drift separately without changing uniqueness rules as part of this phase.
- The dependency installer reported nine audit findings in the dependency tree. No unrelated dependency upgrades were attempted.
