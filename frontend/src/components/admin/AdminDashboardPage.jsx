"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { ProtectedPage } from "../common/ProtectedPage";
import { SectionSkeleton, PageSkeleton } from "../common/SectionSkeleton";
import { useSocket } from "../../hooks/useSocket";
import { useLiveBuses } from "../../hooks/useLiveBuses";
import { adminService } from "../../services/adminService";
import { clearAccessToken } from "../../lib/auth/token";
import { AdminHeader } from "./AdminHeader";
import { AdminOverviewCards } from "./AdminOverviewCards";
import { LiveTransitPanel } from "./LiveTransitPanel";
import { AdminMapWidget } from "./AdminMapWidget";
import { AnalyticsSection } from "./AnalyticsSection";
import { ReportsWidget } from "./ReportsWidget";
import { QuickActions } from "./QuickActions";

const emptyList = [];
const groups = { overview: ['overview'], analytics: ['bookings', 'reports'], transit: ['buses', 'routes', 'stops', 'occupancy'] };
const initialSections = Object.fromEntries(Object.values(groups).flat().map((name) => [name, { status: 'loading' }]));
export default function AdminDashboardPage() {
  return <PageShell><ProtectedPage adminOnly fallback={<PageSkeleton title="Administration dashboard" variant="stats" />}>
    {(user) => <Dashboard key={user._id} profile={user} />}
  </ProtectedPage></PageShell>;
}
function Dashboard({ profile }) {
  const router = useRouter();
  const socket = useSocket();
  const liveUpdates = useLiveBuses([]);
  const [sections, setSections] = useState(initialSections);
  const [connection, setConnection] = useState('connecting');
  const request = useRef(null);
  const [accessError, setAccessError] = useState(false);
  const load = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSections((current) => Object.fromEntries(Object.keys(initialSections).map((key) => [key, { ...current[key], status: 'loading' }])));
    setAccessError(false);
    // KPI work starts first; each group commits independently. Slow map/report
    // queries never prevent successful overview results from appearing.
    for (const group of Object.keys(groups)) {
      adminService.getDashboard(group, { signal: controller.signal }).then((results) => {
        if (!controller.signal.aborted) setSections((current) => ({ ...current, ...results }));
      }).catch((error) => {
        if (controller.signal.aborted) return;
        if ([401, 403].includes(error.response?.status)) { controller.abort(); setAccessError(true); setSections(initialSections); return; }
        setSections((current) => ({ ...current, ...Object.fromEntries(groups[group].map((key) => [key, { status: 'error' }])) }));
      });
    }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; request.current?.abort(); }; }, [load]);
  const buses = sections.buses.data || emptyList;
  // Socket connection lifecycle
  useEffect(() => {
    const markLive = () => setConnection("live");
    const markOffline = () => setConnection("offline");

    socket.on("connect", markLive);
    socket.on("disconnect", markOffline);
    socket.on("connect_error", markOffline);

    return () => {
      socket.off("connect", markLive);
      socket.off("disconnect", markOffline);
      socket.off("connect_error", markOffline);
    };
  }, [socket]);

  // Merge live socket telemetry into buses state
  const liveBuses = useMemo(() => {
    return buses.map((bus) => {
      const update = liveUpdates.find(
        (item) => (item.id || item._id || item.busId)?.toString() === bus._id?.toString()
      );
      if (!update) return bus;

      return {
        ...bus,
        ...update,
        currentLocation:
          update.latitude != null && update.longitude != null
            ? {
                latitude: update.latitude,
                longitude: update.longitude,
                speed: update.speed != null ? update.speed : bus.currentLocation?.speed,
              }
            : bus.currentLocation,
        status: update.status || bus.status,
      };
    });
  }, [buses, liveUpdates]);

  const refreshing = Object.values(sections).some((section) => section.status === 'loading');
  function handleLogout() { clearAccessToken(); router.replace('/login?redirect=/admin/dashboard'); }
  if (accessError) return <div role="alert"><h1 className="text-2xl font-bold">Administrator access could not be verified</h1><button type="button" className="mt-4 underline" onClick={handleLogout}>Sign in again</button></div>;
  return <>
    <AdminHeader profile={profile} connection={connection} onRefresh={load} refreshing={refreshing} onLogout={handleLogout} />
    <div className="mt-6"><DashboardSection section={sections.overview} title="Dashboard statistics" retry={load} skeleton={<AdminOverviewCards loading />}><AdminOverviewCards overview={sections.overview.data} /></DashboardSection></div>
    <div className="mt-6 grid items-stretch gap-6 xl:grid-cols-12">
      <div className="min-h-[460px] min-w-0 xl:col-span-8"><DashboardSection section={sections.stops} title="Transit map" retry={load} skeleton={<SectionSkeleton variant="map" label="Loading transit overview" className="h-full" />}><AdminMapWidget buses={liveBuses} stops={sections.stops.data || []} /></DashboardSection></div>
      <div className="min-w-0 xl:col-span-4"><DashboardSection section={sections.buses} title="Live fleet" retry={load} skeleton={<LiveTransitPanel loading />}><LiveTransitPanel buses={liveBuses} /></DashboardSection></div>
    </div>
    <div className="mt-6"><AnalyticsSection bookingAnalytics={sections.bookings.data || []} occupancyAnalytics={sections.occupancy.data || []} bookingLoading={sections.bookings.status === 'loading'} occupancyLoading={sections.occupancy.status === 'loading'} bookingError={sections.bookings.status === 'error'} occupancyError={sections.occupancy.status === 'error'} onRetry={load} /></div>
    <div className="mt-6 grid items-stretch gap-6 xl:grid-cols-12">
      <div className="min-w-0 xl:col-span-8"><DashboardSection section={sections.reports} title="Incident reports" retry={load} skeleton={<ReportsWidget loading />}><ReportsWidget reports={sections.reports.data?.reports || []} reportsSummary={sections.reports.data?.summary} /></DashboardSection></div>
      <div className="min-w-0 xl:col-span-4"><QuickActions /></div>
    </div>
  </>;
}
function DashboardSection({ section, title, retry, skeleton, children }) {
  if (section.status === 'error') return <section role="alert" className="min-h-32 rounded-2xl border border-[var(--border)] p-5"><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm text-[var(--muted)]">This section is unavailable.</p><button type="button" className="mt-3 underline" onClick={retry}>Retry</button></section>;
  if (section.status === 'loading' && !section.data) return skeleton || <SectionSkeleton label={'Loading ' + title} count={1} />;
  return children;
}
function PageShell({ children }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
