# QA Stage 2: Live bus search and map integration
Date: October 20, 2026

## Scope and confirmed causes
This completes the additional Live Buses search requirement only. Stage 3 has not started.
Search previously filtered the fleet list while markers used a separate active-bus filter. Selecting a bus changed the route dropdown. Lightweight populated route references hid endpoints from normalization. Map resize/bounds effects could override selection focus. A page-level socket watcher redundantly emitted subscriptions on renders even though the shared provider owns subscriptions/reconnects.

## Implemented behavior
- One local selector supplies results and valid-coordinate markers, combining bus number (exact/partial), route name, origin, destination and available stop names with route/status filters. Case and repeated/surrounding spaces are normalized. No request is made per keystroke.
- Live requires active status, valid coordinates and a timestamp no older than 30 seconds, with no offline/cache flag. Excluded matches are explained. All, Last known and existing operational statuses remain available.
- Selection uses the bus ID, highlights its marker and opens the existing details. It does not change filters or automatically enable Follow. Missing GPS remains searchable and displays “Bus found — location unavailable.” without camera movement.
- Latest accepted socket updates preserve query/selection. Offline snapshots retain their real GPS timestamp and last-known position. Removal from the loaded catalogue or a denied catalogue request clears selection. A selected bus excluded by a freshness filter retains details with an explanation.
- Typing never requests a bounds fit. Selection/reselection focuses valid coordinates while retaining zoom when already closer. Reset clears filters/selection/follow and fits all valid bus coordinates. Resize only invalidates map dimensions. Late saved viewport restoration cannot override explicit camera interaction.
- Existing shared Socket.IO subscription/reconnection, caches, route geometry, marker keys and lazy Leaflet loading remain in place. No backend/API/dependency changes.
- Compact results appear beneath the input, with internal scrolling, collapse/reopen, accessible buttons and theme variables. Mobile selection collapses search; the search and details leave space for map controls. Data Saver and reduced motion disable selection/follow animation.

## Files changed
- frontend/src/components/live-map/LiveMapPage.jsx
- frontend/src/components/live-map/LiveBusSearch.jsx (new)
- frontend/src/lib/live-map/liveBusSearch.js (new)
- frontend/src/lib/transit/format.js
- frontend/src/components/map/MapViewport.jsx
- frontend/src/components/map/BusDetailsPanel.jsx
- frontend/src/app/globals.css
- frontend/test/live-bus-search.test.cjs (new)
- QA_STAGE2_REPORT.md

## Verification
- Frontend tests: 37 passed, zero failed. New coverage includes exact/partial/case/space matching, route/endpoints/stops, combined filters and exclusion counts, one/multiple/no matches, missing/invalid/stale/offline GPS, ID selection, catalogue removal, explicit Follow/suspension, reset and panel collapse/reopen.
- Actual MapViewport effect harness verifies initial fit, selection, missing-coordinate selection, updates without recentering, resizing, reset and explicit Follow. Existing tests cover telemetry ordering, shared cache/socket reconnects, heading behavior, manual-follow cancellation, driver GPS and offline loading.
- Production build passed (31 static pages generated).
- Final frontend lint passed with no errors or warnings. git diff --check passed; Git printed only working-copy LF/CRLF conversion notices.
- An initial new test failed because Windows shell encoding replaced its em dash fixture. The fixture now uses a Unicode escape; rerun passed.
- Backend tests were not rerun: this addition changes frontend code only.

## Limits and manual checks
No browser surface was available; no visual or touch interaction is claimed as verified. Check 320px/375px (including the on-screen keyboard), tablet/desktop, all four theme combinations, selection/panel scrolling/collapse, marker highlight, route geometry, live/offline/reconnect transitions, account changes, fullscreen, zoom, compass/North Up and Follow on real data.
Full-map/manual/two-finger rotation remains unavailable in the existing Leaflet fallback. Rotated-map selection has not been tested or implemented here. Existing directional markers and North Up/Follow behavior are retained.
The 15-second freshness display refresh remains unchanged; a timestamp may cross its freshness boundary between refreshes. Missing backend endpoint/stop data cannot be searched until available. No performance timing or production fleet data measurements were invented.
This report does not certify the entire product or all earlier Stage 2 requirements as production-ready.
