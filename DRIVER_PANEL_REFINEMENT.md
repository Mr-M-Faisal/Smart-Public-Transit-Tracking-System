# Driver panel refinement

## Confirmed causes and fixes
- Per-page operations remounts reloaded data; GPS existed only inside Track. A persistent driver layout now owns one operations component and one reusable GPS hook across driver routes.
- Existing Socket.IO was already a shared singleton. Its transport and authorization remain unchanged.
- GPS already had an eight-second request timeout, but lacked fix acceptance and reconnect recovery. The hook now rejects fixes older than 30 seconds, invalid coordinates and accuracy worse than 100 metres; serializes uploads; cleans up on exit; and handles online/foreground recovery without automatic permission-denied reprompting.
- Authorization errors halt uploads and refresh authoritative profile/shift state. GPS On requires confirmed updates and fresh timestamps. Older timestamped UI updates are rejected.
- Current Location is the reported stop, not a street address. Before a stop is reported, Location unavailable is legitimate.
- Very low positive average speed produced enormous backend ETA estimates. The small ETA helper now returns the existing nullable result for near-stationary/invalid speed or estimates over 120 minutes. Units, route-progress logic, direction and the existing no-samples 20 km/h fallback remain unchanged.
- Unavailable ETA no longer appears as an ongoing calculation.
- The driver map previously connected stops with straight lines. It now uses stored geometry for the actual direction, and states when road geometry is unavailable.
- Route stops already come from ordered RouteStop assignments merged with legacy records. No GPS-based truncation was found. A read-only fleet count audit failed, so actual one-stop-route data remains unverified. No stops were invented.

## UI changes
Stage A was built, linted and tested before Stage B.
- Home: compact bus/route/duty/GPS overview, next stop, ETA and one primary action.
- Shift: one constrained readable panel with existing confirmation and pending guards.
- Route: stop timeline and current/next/completed states. Start Return Trip remains available here.
- Track: compact status row, primary map, secondary GPS controls and authorized passenger pickups.
- Existing navigation, seats and reporting remain in place. Loaded data stays visible on transient refresh failures; authorization failures hide it.

## Modified files
Frontend:
- src/app/driver/layout.js (new), loading.js
- src/app/driver/{dashboard,shift,route,tracking,seats}/page.js
- src/components/driver/DriverDashboardClient.jsx
- src/components/driver/DriverDashboardPage.jsx
- src/components/driver/DriverStatusCard.jsx
- src/components/driver/DriverLocationControl.jsx
- src/components/driver/DriverRouteCard.jsx
- src/components/driver/DriverMap.jsx
- src/hooks/useDriverLocation.js (new)
- src/lib/transit/driverGps.js (new)
- src/lib/transit/driverDisplay.js
- src/app/globals.css
- test/driver-gps.test.cjs (new)
- test/driver-display.test.cjs

Backend:
- src/controllers/busController.js
- src/utils/eta.js (new)
- test/eta.test.js (new)
- package.json (adds ETA tests to npm test)

## Verification
- Stage A: lint, production build and 13 frontend tests passed.
- Final frontend: lint, production build and 19 tests passed.
- Backend npm test: 49 passed, zero failed, using the existing isolated test database.
- Backend integration coverage includes shift authorization/concurrency/end, real Socket.IO GPS delivery, ETA, return trip, bookings/seats, passenger pickup privacy and route-stop ordering/legacy records.
- GPS hook tests simulate browser callbacks and cover fix rejection, cleanup, denied permission, offline/reconnect, authorization failure and in-flight callbacks.
- git diff --check passed.

## Remaining checks and production risks
- No browser surface was available. Test 320/375/430/768/1024/1440px, all four themes, actual permissions, touch interactions, navigation and installed-PWA behavior manually.
- GPS persists within /driver routes. Leaving that workspace, closing the app or mobile OS background suspension can stop tracking. Continuous background GPS is not promised.
- Validate 100-metre accuracy and ETA thresholds on real devices/routes. Poor urban GPS may be rejected.
- Older telemetry guards protect UI state; they are not server-side ordering guarantees between multiple devices.
- Nullable ETA changes affect all consumers of the existing bus ETA endpoint. No schema migration or new endpoint was introduced.
- Fleet database stop counts remain unverified. Do not treat an actual one-stop route as a UI bug without inspecting its data.
- Loading-time and bundle-size deltas were not measured. No dependencies or polling requests were added; Leaflet remains lazy-loaded.
