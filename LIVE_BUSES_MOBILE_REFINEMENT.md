# Live Buses mobile refinement
Date: October 20, 2026

## Confirmed defects and fixes
- Expanded fleet results consumed map space by default. Search now starts as one input with expand/clear controls; typing opens bounded scrollable results, selection collapses them and keeps the query.
- The details card lacked a compact state. BusTrackingSheet provides a bus/route/GPS summary, accessible expand/collapse and close controls, and independently scrolling details. Only available direction/timestamp/next-stop/ETA values appear. Selection by ID preserves sheet state across telemetry updates.
- The existing 100dvh !important map rule extended behind navigation. Scoped mobile sizing now reserves 66px plus the bottom safe area, with the sheet above attribution and controls in a separate right-hand column.
- Follow previously could resume when freshness returned. Loss of usable telemetry now suspends Follow; recovery requires an explicit user action.
- Transport failure was conflated with device-offline messaging. The selected-bus status distinguishes usable fresh GPS, missing GPS, last-known GPS and device offline. Low reported accuracy can indicate weak GPS. A stale fix does not establish that a driver is offline.
- Secondary home/network/fullscreen actions now sit in a More group. Zoom, Locate Me and selected-bus Follow remain directly accessible. Fullscreen targets the map surface including its controls and details.
- Stable selection callback and marker field comparisons avoid marker rerenders caused solely by unrelated search state. No new requests, dependencies, cache changes or backend changes.

## Files changed for this refinement
- frontend/src/components/live-map/LiveMapPage.jsx
- frontend/src/components/live-map/LiveBusSearch.jsx
- frontend/src/components/live-map/BusTrackingSheet.jsx (new)
- frontend/src/lib/live-map/liveBusSearch.js
- frontend/src/lib/live-map/trackingStatus.js (new)
- frontend/src/components/map/MapControls.jsx
- frontend/src/components/map/BusMarker.jsx
- frontend/src/app/globals.css
- frontend/test/live-bus-search.test.cjs
- LIVE_BUSES_MOBILE_REFINEMENT.md

Previous Stage 2 changes were already present in the working tree and preserved.

## Verification
39 frontend tests passed, including search/filter/reset/camera, compact state/selection/close, stale/missing/offline/weak telemetry and Follow availability. Existing heading, cache, Socket.IO reconnect and driver GPS tests passed.
Production build passed. Frontend lint passed without warnings or errors. git diff --check passed (only Git line-ending conversion notices).
The bottom-sheet handle uses native pointer events with a 35px vertical threshold. Keyboard activation uses the same button. Swipe behavior is implemented but not browser-verified.

## Remaining checks and limits
Browser inventory returned no browsers/apps. Manually test 320, 375, 430, 768, 1024 and 1440px in Light/Dark and Blue/Orange: search with keyboard open, no/multiple results, selection/close, sheet expansion/swipe/scroll, pan/zoom, fullscreen, attribution, bottom navigation and device safe areas. Check live telemetry during search and stale-to-fresh recovery with real devices.
The inspected bus contract supplies no authoritative driver-online status; it is deliberately reported as unknown. Weak accuracy may not be supplied by current public payloads. Freshness remains 30 seconds with the existing 15-second display tick.
The existing Leaflet map is north-up and has no manual/two-finger rotation or compass-reset implementation. None was removed; rotation gestures cannot be certified. No screenshot was available in the attachment, so visual work followed the written requirements and existing styles.
Backend, booking, shifts and infrastructure were not changed. Unrelated optimization work was not started.
