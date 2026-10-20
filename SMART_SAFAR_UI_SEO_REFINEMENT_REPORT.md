# Smart Safar UI and SEO refinement
Date: October 20, 2026

## Audit and confirmed inconsistencies
Plus Jakarta Sans and semantic light/dark, blue/orange tokens already existed. Public Home, Routes, Live Buses and admin searches used separate markup, heights, clear actions and focus treatments. Shared Button/Card primitives existed and were retained. Driver-specific styles already standardized much typography, but competing surface rules and narrow panels remained. Home contained a direct Start Shift mutation alongside the Shift workflow. Footer groups stacked vertically with repeated access links. Public metadata was generic; detail titles exposed database IDs; sitemap/robots and a public explanatory About page were missing.

## Shared UI
Added SearchInput for Home, Routes, Live Buses, compact admin searches (including routes, buses and stops) and stop-location search. It provides a common icon, 48px field, clear button, focus indicator, labels, ref support, busy and disabled states. Each page retains its own query/filter/submission behavior. Commuter search remains a navigation link rather than being changed into a fake input. Shared button focus/disabled styles and scoped heading scales are consistent with existing tokens. No global page redesign or new dependencies.

## Driver responsibilities and themes
Home shows the existing synchronized overview and directs off-duty drivers to Manage Shift; on-duty drivers can open tracking. Home no longer invokes a shift mutation.
Shift retains the shared operations state, pending guards and backend authorization. End confirmation remains, and an explicit Start confirmation was added because the inspected implementation previously started immediately. Confirmation checks that duty state has not changed since opening. No backend, GPS lifecycle, booking or shift-service code changed.
Shared driver surfaces now resolve to card/background/border/foreground tokens, with an 820px Home/Shift content width. Existing driver scale and page-specific Route/Track/Seats/Reports layouts remain.

## Footer and About
Footer uses compact branding, a short description, two grouped navigation areas and copyright. Mobile layout uses a compact grid and 44px link targets; existing bottom navigation remains separate with safe-area padding. Mobile Live Map omits the public footer.
New /about is a server component with one H1, semantic sections, feature limitations, usage steps, audiences, coverage caveat and software engineering project background. Routes, Live Map and the existing support mailto are linked. No affiliation, statistics or complete-city coverage is claimed. Existing support address is reused, not independently verified.

## SEO
- Unique Home, Routes, Live Map and About metadata plus readable route/bus detail titles.
- App Router metadata, Open Graph/Twitter fields and approved /images/logo.png.
- Private noindex layouts for driver, admin, booking, trips, profile, settings, reports, login/register and Safety. Safety was confirmed authenticated and excluded from the public sitemap. Existing authorization remains separate.
- Public sitemap allowlist: /, /routes, /live-map, /about. No private pages or unverified database records are listed.
- robots.txt excludes API/private paths; noindex metadata also applies to private pages.
- WebSite JSON-LD includes only real project name, description, language and configured origin.
- Canonical URLs use only validated NEXT_PUBLIC_SITE_URL, shared by sitemap and structured data. No domain was verified in this session and the clarification remains unanswered. Without it, URL-bearing metadata/schema are omitted and sitemap contains no entries. Set the actual HTTPS production origin before production build/deployment, then verify generated canonical/social/sitemap output. Infrastructure was not changed.
- Implementation follows installed Next.js documentation and https://nextjs.org/docs/app/api-reference/functions/generate-metadata .

## Modified files for this task
Frontend source:
- src/components/common/SearchInput.jsx (new)
- src/components/home/HomePage.jsx
- src/components/routes/RoutesPage.jsx
- src/components/live-map/LiveBusSearch.jsx
- src/components/admin/CompactPageSearch.jsx
- src/components/admin/stops/LocationSearch.jsx
- src/components/driver/DriverStatusCard.jsx
- src/components/navigation/Footer.jsx
- src/app/globals.css
- src/lib/seo.js (new)
- src/app/layout.js, page.js, routes/page.js, live-map/page.js
- src/app/routes/[id]/page.js, buses/[id]/page.js
- src/app/about/page.js, sitemap.js, robots.js (new)
- src/app/driver/layout.js
- src/app/{admin,booking,my-trips,profile,settings,reports,login,register,safety,safety/track}/layout.js (new)
- test/seo.test.cjs (new)
- SMART_SAFAR_UI_SEO_REFINEMENT_REPORT.md

Previous live-map changes were already uncommitted and preserved. Safety page was restored to its client implementation after discovering it is protected; metadata lives in its server layout.

## Verification
- 42 frontend tests passed, zero failed.
- Frontend lint passed, no warnings/errors.
- Production build passed: 34 generated static pages, including About, robots and sitemap.
- Built HTML checks confirmed About prose/one H1 and noindex on driver/admin/profile/login.
- Metadata tests validate a configured test origin, reject localhost/insecure origins, verify logo URLs and parse structured data without fabricated ratings.
- git diff --check passed; only Git LF/CRLF conversion notices.
- Initial build caught metadata being attached directly to the client Safety page; corrected by retaining its client boundary and using private layout metadata.
- Backend tests were not rerun; backend unchanged.

## Manual verification and remaining risks
No browser surface was available; no screenshot, gesture, screen-reader, keyboard or responsive visual pass is claimed. Check 320/375/430/768/1024/1440px in all four themes; focus/clear/search result selection, stop search submission, footer links and bottom navigation, About links, driver Home-to-Shift navigation, both shift confirmations and pending/error states, GPS synchronization, reduced motion and overflow.
Confirm the real production domain and existing support email before launch. Validate configured JSON-LD with an external validator and inspect deployed robots/sitemap/canonicals. No indexing or ranking improvement is guaranteed.
Dynamic fleet details remain interactive and are not enumerated in sitemap without a verified public data source. Existing actual full-map rotation limitation remains unchanged.
