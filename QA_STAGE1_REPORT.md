# Smart Safar QA: baseline and Stage 1
Date: 2026-10-19

Scope: Phase 0 repository baseline and Stage 1 critical reliability only. Stage 2 has not started. This is not a production-readiness certification.

## Baseline and repository audit

- Existing working-tree map heading/follow changes were preserved. They already affected globals.css, DriverMap, LiveMapPage, BusMarker, MapControls, MapViewport, transitMarkerIcons, mapHeading.js and map-heading.test.cjs. Stage 1 adds telemetry merge changes to LiveMapPage; it does not implement map rotation.
- Frontend AGENTS.md, CLAUDE.md and the installed Next.js client-component documentation were read.
- Backend entry point: Express/Socket.IO in backend/src/server.js. API groups: auth, routes, stops, buses, bookings, reports, route-alerts, admin and safety.
- Authorization: protect verifies JWT and reads current database role/assignment per request; authorize checks roles. GPS checks both driver-to-bus relationships and an active shift. No permission cache added.
- Persistence: Mongoose models include User, Bus, Shift, Route, Stop, RouteStop, Booking, Report, RouteAlert and SafetySession. Existing transactionService is reused. Active Shift uniqueness is enforced separately for driver and bus. No schema/index changes.
- Bookings/seats: bookingService, seatService and paymentService implement transactions, per-user idempotency, configured seat state, payment and pickup-consent checks. Baseline tests exercise last-seat conflicts, cancellation, walk-ins and private pickup delivery. Their deeper audit remains Stage 3/4.
- GPS: persistent driver layout owns DriverOperations and one useDriverLocation watcher. Browser acquisition timeout is 20 seconds; upload timeout is 8 seconds. Client fix acceptance is 30 seconds and 100 metres. Existing tests cover cleanup, permissions, offline recovery and in-flight callbacks.
- ETA: busController uses ordered RouteStop/legacy stops, straight-line kilometres and recent speed samples in km/h. estimateEtaMinutes retains the existing no-samples 20 km/h fallback and nullable output. Near-zero speed and >120-minute safeguards already existed.
- Maps: shared lazy Leaflet shell and marker/viewport components, saved outbound/return geometry, north-up follow fallback. Existing heading tests remain in the frontend suite. No rotation plugin was added.
- Socket.IO: shared frontend connection; public watchBus rooms carry locations/seats; authenticated driver rooms carry opted-in pickup data. GPS/shift event names and existing payload fields are retained.
- Offline: service worker restricts caches to public shells/static assets; query persistence allow-lists public reference data and bus metadata. Live GPS/seat state stays in memory. The booking queue uses existing idempotency keys and bounded reconciliation. No queue/cache schema or splash changes.
- Baseline backend npm test: 49 passed, 0 failed, about 306.7 seconds. Tests explicitly choose randomly named isolated databases and verify their names before cleanup.
- Baseline frontend: 25 tests passed; npm run lint passed; npm run build passed.
- No browser/app surface was available. No production request or deployment was performed. No production data was modified.

## QA findings and fixes

| ID | Module | Problem | Severity | Reproduction / evidence | Root cause | Fix / status |
|---|---|---|---|---|---|---|
| S1-01 | GPS API | Out-of-range coordinates and invalid speed/accuracy/capture time accepted | P1 | Isolated HTTP regression sent latitude 91; received 200 before fix | Only non-null coordinates checked; accuracy/time ignored | Numeric bounds, 100 m accuracy, 30 s capture age and 0-144 km/h validation; fixed |
| S1-02 | GPS persistence | Delayed fix overwrites newer coordinates | P1 | Send newer timestamp then older/duplicate; old API returned 200 | Receipt-time overwrite and unprotected read/save | Compare capture time inside existing transaction; reject older/equal fixes with 422; fixed |
| S1-03 | Shift/GPS authorization | An in-flight GPS write succeeds after shift completion | P0 | Pause real Bus.save, complete shift, release GPS write; old API returned 200 | Authorization check and save were separate operations | Transaction writes conflict with shift end/reassignment; retry rechecks authoritative state; fixed |
| S1-04 | ETA API | Stale/missing/inactive telemetry still produces ETA | P1 | Stale test bus returned 1.1 minutes before fix | ETA calculation did not gate GPS freshness | Nullable ETA/distance and no progress advancement for stale telemetry; fixed |
| S1-05 | New shift | Previous shift's timestamp and speed history survive restart | P1 | Seed fresh timestamp/speed, start new shift; values persisted before fix | Start reset direction/progress only | Reset timestamp and speed samples; retain coordinates as historical position; fixed |
| S1-06 | GPS hook | Late successful upload can replace denied/offline state with GPS On | P1 | Controlled promise resolves after permission-denied/offline callback | Success only checked mounted state | Signal revision, connectivity and permission guards; fixed |
| S1-07 | Live UI | Active shift or connected socket presented as fresh GPS; null ETA retains old estimate | P1 | BusCard used status alone; BusDetails overlay used connection; merge used null fallback | Duty, connectivity and telemetry were conflated | Fresh-coordinate/time checks, 30 s driver expiry, null-aware ETA merge and explicit last-known labels; fixed |
| S1-08 | Driver terminology | Current Location was a stop name and missing stop implied missing GPS | P2 | DriverStatusCard consumed ETA currentStop under Current Location label | Stop and GPS terminology mixed | Current Stop / Not reported; permission denial shown distinctly; fixed |
| S1-09 | Shift timeout UI | Timeout after committed mutation did not reconcile shift state | P1 | Catch branches refreshed only for 409 | Assumed a transport failure meant no state change | Refresh authoritative profile after all failed start/end requests; no mutation retry; fixed by source review, browser timeout scenario unverified |
| S1-10 | Shared socket cache | Older events overwrite fresh snapshots; rooms not rejoined on reconnect | P1 | Actual provider effect regression injects older event and reconnect | Unconditional cache merge; watched set survived disconnect | Ordered merge and room resubscription on connect; equal-time idle state wins; fixed |
| S1-11 | Commuter GPS coordinates | LiveMap helper ignores top-level socket coordinates | P1 | Actual helper called with latitude/longitude returned null | Helper only read position/currentLocation | Accept existing socket payload format; fixed |
| S1-12 | Admin fleet | Dashboard data loaded outside transit-query cache had no bus room subscription | P1 | Dashboard listened for events but never emitted watchBus for its fleet | Shared provider only watches buses in its query cache | Dashboard subscribes its existing fleet on load/reconnect; fixed |
| S1-13 | ETA read | GET ETA could report a stop index advanced only in memory | P2 | calculateNextStopAndETA mutated the loaded document on reads without persisting | Shared update/read calculation had no read-only option | GET disables advancement; GPS update remains the progress writer; fixed |

| S1-14 | Assignment/shift lifecycle | Reassigning an active bus retains the former driver's active Shift record | P1 | updateFleetBus changes both assignment links but never completes Shift; active bus uniqueness then prevents a replacement shift | Reassignment and shift completion policies are separate | Documented unresolved: end the current shift before reassignment. A policy to reject active reassignment or explicitly transfer/end duty needs a scoped follow-up; no automatic deletion or silent shift completion added |

Reproduction tests initially failed for all five tested backend defects after correcting a required-field test-fixture setup error. Those failures are evidence of pre-fix defects, not final failures.

## Changes made

Backend:
- src/controllers/busController.js: transactional GPS authorization/ordering/save, unchanged event names, session-bound stop reads, stale ETA guard and read-only ETA calculation.
- src/utils/gps.js (new): coordinate/speed/accuracy/capture-time validation and freshness checks.
- src/services/shiftService.js: reset telemetry freshness and speed history at shift start.
- test/gps-reliability.test.js (new): isolated database validation, ordering/concurrency, ETA, paused-save shift end/reassignment and restart tests.
- package.json: include GPS regressions in npm test.

Frontend:
- src/hooks/useDriverLocation.js: capture timestamp/accuracy payload; late response guards; out-of-order rejection remains recoverable.
- src/components/driver/DriverDashboardPage.jsx: reconcile uncertain shift mutations and protect newer operational state from old telemetry.
- src/lib/transit/driverDisplay.js and src/components/driver/DriverStatusCard.jsx: 30-second freshness, distinct Permission Denied, accurate Current Stop terminology.
- src/lib/transit/liveTelemetry.js (new): freshness, ordered merge and nullable ETA formatting.
- src/hooks/useTelemetryNow.js (new): one shared five-second display expiry clock; no network polling.
- src/hooks/useLiveBuses.js and src/components/providers/TransitProvider.jsx: ordered socket merges and reconnect room restoration.
- src/lib/transit/format.js: accept top-level socket coordinates.
- src/components/bus/BusCard.jsx and BusDetailsPage.jsx: fresh-GPS/last-known indicators and unavailable ETA.
- src/components/live-map/LiveMapPage.jsx: reject older snapshots and clear explicit null ETA.
- src/components/admin/AdminDashboardPage.jsx and LiveTransitPanel.jsx: fleet subscriptions and duty/GPS distinction.
- test/driver-gps.test.cjs, test/driver-display.test.cjs, test/live-telemetry.test.cjs (new): callback, status, merge, coordinate and actual provider-effect regressions.

## Verification

- Backend `npm test`: 55 passed, 0 failed (about 339.2 seconds). Includes six new GPS regressions and existing role, assignment, shift concurrency, real Socket.IO, bookings/seats, privacy, geometry, dashboard, CORS and compression checks.
- Frontend `node --experimental-vm-modules --test test/*.test.cjs`: 32 passed, 0 failed (25 baseline plus seven new tests). GPS callbacks and provider reconnects are simulated; this is not a browser/device pass.
- Frontend `npm run lint`: passed after final source changes.
- Frontend `npm run build`: passed after final source changes; 31 pages generated.
- `git diff --check`: passed. Git only reports existing LF/CRLF normalization notices.
- Backend has no separate lint/build script; it runs directly as Node.js JavaScript.
- Final automated failures: none. Browser/device/installed-PWA testing: blocked by absence of an available browser surface. Production verification: not run, deferred to Stage 6.
- The six GPS regressions test invalid fixes, delayed/duplicate/concurrent ordering, stale ETA, in-flight reassignment, in-flight shift completion, and telemetry reset on a new shift.

## Compatibility and remaining risks

- Existing GPS clients may omit timestamp/accuracy. Those requests remain compatible and are ordered by server receipt time; the server cannot reconstruct their original GPS capture time or accuracy. Updated frontend sends both fields. Backend deployment should precede frontend deployment.
- lastLocationUpdate now represents accepted capture time for updated clients. A supplied time must be no more than 30 seconds old and not in the future. Device clock skew can reject valid physical positions; test real devices and enable automatic device time.
- MongoDB transactions are now used per GPS write, reusing the deployment requirement already present for shifts/bookings. They add database work; upload latency and fleet-scale throughput were not benchmarked. Existing eight-second frontend timeout remains.
- A response lost after a committed shift remains an uncertain transport outcome. The frontend performs an authoritative GET without replaying the mutation; if that read also fails, refresh after reconnect.
- Multiple-device database ordering is tested. It does not authenticate physical GPS truth or eliminate device clock differences.
- The browser can suspend GPS in the background or after leaving the driver workspace. Continuous background tracking is not promised. Logout cleanup is hook-tested, not real-device tested.
- Map bearing rotation remains unavailable as previously documented. Road geometry/route progress, skipped stops, U-turns, deviations, noisy arrival detection and return-trip race analysis belong to Stage 2. No changes to those algorithms beyond read-only/stale ETA safeguards.
- ETA still uses straight-line distance and the existing no-speed fallback. These are estimates, not measured road travel times. Calibration/off-route correctness remains unverified.
- Mid-shift reassignment now blocks in-flight writes by the former driver. Existing management behavior can retain that driver's active Shift record; lifecycle policy and repair need an explicit later-stage review, not silent data deletion.
- Display expiry checks are periodic: new shared consumers tick every five seconds; existing driver/live-map timers tick every fifteen seconds. No GPS positions are synthesized.
- No response-size, navigation timing, memory, bundle delta or throughput numbers were measured. No dependency, schema/index, booking rule, splash or environment-variable change was made.
- Production deployment and authenticated production E2E checks were not run (Stage 6).

## Manual checks blocked in this environment

No browser surface or real-device GPS access was available:
1. With a dedicated test driver, start a shift and move between Home, Shift, Track and Seats. Confirm one browser geolocation watcher and one upload at a time; verify timestamp/accuracy are sent.
2. Deny/revoke location permission while an upload is pending. Confirm Permission Denied remains visible; foregrounding must not reprompt automatically.
3. Stop delivering fixes for more than 30 seconds. After the next display expiry tick, confirm no Live/GPS On indicator or reliable ETA; last-known positions may remain.
4. Disconnect/reconnect the network. Verify bus-room subscriptions resume and a fresh accepted fix restores GPS status. Test the same in the installed PWA after foregrounding.
5. Use network throttling to lose a shift response after server success. Confirm authoritative refresh resolves the shift, and repeat clicks cannot create duplicate shifts.
6. Use a second test device or admin reassignment while GPS is in flight. Confirm the old assignment cannot upload after the reassignment commits.
7. Check driver, commuter and admin pages at 320/375/430/768/1024/1440 px in all four themes, with keyboard navigation. No visual pass is claimed.
8. Production checks remain pending Stage 6 approval and authorized test accounts; local results do not establish deployed behavior.

## Next stage

After approval only: Stage 2 map/route correctness, including stored outbound/return geometry, route-progress edge cases and safe map interaction/rotation options.
