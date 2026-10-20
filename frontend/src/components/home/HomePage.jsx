"use client";
import { SearchInput } from "../common/SearchInput";

import Image from "next/image";
import Link from "../common/SmartLink";
import { useEffect, useRef, useState } from "react";
import { BusFront, ArrowRight,
  CheckCircle2,
  Clock3,
  Map,
  MapPin,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Smartphone,
  Users, } from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { BusCard } from "../bus/BusCard";
import { RouteCard } from "../route/RouteCard";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { SectionSkeleton } from "../common/SectionSkeleton";
import { EmptyState } from "../common/EmptyState";
import { useTransitQuery, useLiveConnection } from "../../hooks/useTransitQuery";
import { transitQueries } from "../../lib/query/transitQueries";
import { CacheStatus, useOnline } from "../common/CacheStatus";
import { useDataSaver } from "../../hooks/useDataSaver";
import { normalizeBus, getRouteId } from "../../lib/transit/format";

const benefits = [
  { title: "Live Tracking", text: "See active buses across the city.", icon: Map },
  { title: "Useful ETAs", text: "Know when an operating bus is due.", icon: Clock3 },
  { title: "Seat Updates", text: "Check availability before you board.", icon: Users },
  { title: "Browser Access", text: "No app installation is required.", icon: Smartphone },
];

const isOperating = (bus) => String(bus.status).toLowerCase() === "active";

function motionSafeScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.dataSaver === "on" ? "auto" : "smooth";
}

function MobileBusCard({ bus }) {
  return <Link href={`/buses/${bus.id}`} className="mobile-bus-card premium-card premium-card--operational flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.05)]">
    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]"><BusFront size={29} /></span>
    <span className="grid min-w-0 flex-1 gap-1"><strong className="truncate text-sm text-[var(--foreground)]">{bus.number}</strong><small className="truncate text-xs text-[var(--muted)]">{bus.directionLabel || bus.routeName}</small></span>
    <span className="flex-none text-right"><small className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{bus.isSaved ? "Last known" : "Live"}</small>{!bus.isSaved && bus.eta && <strong className="mt-1 block text-xs text-[var(--foreground)]">{bus.eta}</strong>}</span>
  </Link>;
}

export default function HomePage() {
  const routesQuery = useTransitQuery(transitQueries.routes());
  const busesQuery = useTransitQuery(transitQueries.buses());
  const online = useOnline();
  const connected = useLiveConnection();
  const { enabled: dataSaver } = useDataSaver();
  const routes = routesQuery.data || [];
  const routeMap = Object.fromEntries(routes.map((route) => [getRouteId(route), route]));
  const [now, setNow] = useState(0);
  const buses = (busesQuery.data || []).map((bus) => {
    const updated = new Date(bus.lastLocationUpdate || 0).getTime();
    const fresh = now > 0 && updated > 0 && updated <= now && now - updated <= 30000;
    return { ...normalizeBus(bus, null, routeMap), isSaved: !online || !connected || busesQuery.isError || busesQuery.isStale || !fresh };
  });
  const transitLoading = routesQuery.loading;
  const transitError = routesQuery.isError && !routesQuery.data;
  const showingSavedTransit = !online || routesQuery.isError;
  const [searchTerm, setSearchTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (window.location.hash === "#transit-search") searchRef.current?.focus();
  }, []);

  useEffect(() => {
    let timer;
    const update = () => {
      const current = Date.now();
      setNow(current);
      const deadlines = (busesQuery.data || []).map((bus) => new Date(bus.lastLocationUpdate || 0).getTime() + 30001).filter((deadline) => Number.isFinite(deadline) && deadline > current);
      window.clearTimeout(timer);
      if (deadlines.length) timer = window.setTimeout(update, Math.min(Math.min(...deadlines) - current, 30001));
    };
    queueMicrotask(update);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", update); };
  }, [busesQuery.data]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeBuses = buses.filter(isOperating);
  const liveBusCount = activeBuses.filter((bus) => !bus.isSaved).length;
  const networkLabel = !online ? "Offline" : busesQuery.loading ? "Checking" : busesQuery.isError ? "Unavailable" : liveBusCount ? "Live updates" : activeBuses.length ? "Last known" : "No active service";
  const matchingBuses = normalizedSearch ? activeBuses.filter((bus) => `${bus.number} ${bus.route} ${bus.routeName} ${bus.nextStop || ""}`.toLowerCase().includes(normalizedSearch)) : [];
  const matchingRoutes = normalizedSearch ? routes.filter((route) => `${route.routeName} ${route.startPoint} ${route.endPoint} ${route.description || ""}`.toLowerCase().includes(normalizedSearch)) : [];
  const displayedBuses = hasSearched && normalizedSearch ? matchingBuses : activeBuses;
  const displayedRoutes = hasSearched && normalizedSearch ? matchingRoutes : routes;

  function handleSearch(event) {
    event.preventDefault();
    const validSearch = Boolean(searchTerm.trim());
    setHasSearched(validSearch);
    if (validSearch) document.getElementById("live-transit")?.scrollIntoView({ behavior: motionSafeScrollBehavior(), block: "start" });
  }

  function focusSearch() {
    window.history.replaceState(null, "", "#transit-search");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    searchRef.current?.focus();
  }

  return <div className="home-page public-shell min-h-screen overflow-x-hidden bg-[var(--background)]">
    <Navbar /><CacheStatus query={routesQuery} />
    <main>
      <section className="home-premium-hero relative overflow-hidden border-b border-[var(--border)] bg-[var(--primary-soft)]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-6 pt-7 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <div className="home-hero-content relative z-10">
            <Badge tone="success" className="hidden md:inline-flex">Faisalabad transit network</Badge>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--primary-ink)] md:hidden">Faisalabad&apos;s transit companion</p>
            <h1 className="mt-2 max-w-2xl text-[2.5rem] font-extrabold leading-[1.04] tracking-[-0.045em] text-[var(--foreground)] sm:text-5xl lg:mt-5 lg:text-[3.5rem]">Smart Safar</h1>
            <p className="home-hero-tagline mt-3 max-w-xl text-lg leading-7 sm:text-xl md:mt-5 md:text-2xl md:leading-8">Your smarter way to move around Faisalabad.</p>
            <p className="home-hero-support mt-2 max-w-xl text-sm leading-6 sm:text-base sm:leading-7">Find live buses, explore routes, check arrivals, and plan your journey with confidence.</p>
            <div className="home-hero-actions mt-6 grid grid-cols-2 gap-2.5 sm:flex sm:flex-row md:mt-8"><Link href="#live-transit" className="home-hero-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] transition hover:bg-[var(--primary-dark)] sm:px-5">View Live Buses <ArrowRight size={17} /></Link><Link href="#routes" className="home-hero-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)] hover:text-[var(--primary-ink)] sm:px-5">Explore Routes <Map size={17} /></Link></div>
            <div className="mt-8 hidden flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--muted)] md:flex"><span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--primary-ink)]" /> No login required</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--primary-ink)]" /> Live network updates</span></div>
          </div>
          <div className="home-hero-media relative mx-auto w-full max-w-lg lg:mx-0 lg:justify-self-end">
            <div className="overflow-hidden rounded-[2rem] border border-[var(--primary-border)] shadow-[0_24px_60px_rgba(15,23,42,0.15)]">
              <div className="relative h-[310px] sm:h-[360px]">
                {!dataSaver && <Image src="/smart-safar-transit-hero.webp" alt="Modern Smart Safar bus travelling through the city at sunset" fill priority sizes="(min-width: 1024px) 512px, (min-width: 768px) 512px, calc(100vw - 32px)" className="object-cover" />}
                {dataSaver && <div className="home-hero-data-saver"><BusFront size={64} aria-hidden="true" /><span>Faisalabad transit network</span></div>}
                <div className="home-hero-overlay absolute inset-0" />
                <div className="home-hero-status absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/30 px-4 py-3 shadow-lg backdrop-blur-xl">
                  <div>
                    <p className="text-xs text-white/70">Network status</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {busesQuery.loading ? "Checking service..." : busesQuery.isError ? "Bus information is unavailable" : `${activeBuses.length} ${activeBuses.length === 1 ? "bus" : "buses"} reported active`}
                    </p>
                  </div>
                  <Badge tone={liveBusCount ? "success" : "neutral"}>{networkLabel}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="transit-search" className="relative z-20 mx-auto max-w-5xl scroll-mt-24 px-4 pt-4 sm:px-6 md:-mt-7 md:pt-0"><Card treatment="operational" className="home-search-card p-2.5 sm:p-3"><form onSubmit={handleSearch} className="flex flex-col gap-2.5 sm:flex-row"><SearchInput inputRef={searchRef} value={searchTerm} onChange={(value) => { setSearchTerm(value); setHasSearched(false); }} label="Search routes, buses or stops" placeholder="Route, bus or stop" /><button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]"><Search size={17} /> Find transit</button></form>{hasSearched && <p className="mt-3 border-t border-[var(--border)] px-1 pt-3 text-sm text-[var(--muted)]">{matchingBuses.length + matchingRoutes.length > 0 ? `${matchingBuses.length + matchingRoutes.length} matching transit result${matchingBuses.length + matchingRoutes.length === 1 ? "" : "s"}.` : "No matching transit found. Try a route, bus number or stop."}</p>}</Card></section>

      <section data-home-reveal className="home-quick-actions mx-auto max-w-5xl px-4 pt-4 sm:px-6 md:hidden" aria-label="Quick actions"><div className="grid grid-cols-3 gap-2"><Link href="/live-map" prefetch={false} className="public-quick-action premium-card premium-card--glass"><span><BusFront size={19} /></span>Live Buses</Link><Link href="/routes" className="public-quick-action premium-card premium-card--glass"><span><RouteIcon size={19} /></span>Routes</Link><button type="button" onClick={focusSearch} className="public-quick-action premium-card premium-card--glass"><span><Search size={19} /></span>Find a Bus</button></div></section>

      <section id="live-transit" className="home-content-section home-live-section mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-6 md:py-16 lg:px-8"><div className="home-section-heading flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">{networkLabel}</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl md:mt-2">Live Transit</h2><p className="mt-1 text-xs text-[var(--muted)] sm:text-sm md:mt-2">{busesQuery.loading ? "Checking active services." : `${activeBuses.length} reported active | ${liveBusCount} with recent GPS updates. Last-known details are labelled.`}</p></div><Link href="/live-map" prefetch={false} className="inline-flex min-h-10 flex-none items-center gap-1 text-xs font-bold text-[var(--primary-ink)] sm:text-sm">View all <ArrowRight size={15} /></Link></div>
        {busesQuery.loading ? <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((key) => <SectionSkeleton key={key} label="Loading bus" count={1} />)}</div> : busesQuery.isError && !busesQuery.data ? <div className="mt-4"><EmptyState title="Live transit is unavailable" description="We couldn't retrieve current bus information right now." /></div> : displayedBuses.length ? <><div className="mt-4 grid gap-2.5 md:hidden">{displayedBuses.slice(0, 3).map((bus) => <MobileBusCard key={bus.id} bus={bus} />)}</div><div className="mt-8 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">{displayedBuses.slice(0, 6).map((bus) => <BusCard key={bus.id} bus={bus} />)}</div></> : <div className="mt-4"><EmptyState title={showingSavedTransit ? "Live updates are paused" : hasSearched ? "No active buses found" : "No buses operating right now"} description={showingSavedTransit ? "Connect to the internet for current bus positions and arrival times." : hasSearched ? "Try another bus number, route, or stop." : "Live details will appear when service is active."} /></div>}
      </section>

      <section className="home-content-section home-map-section border-y border-[var(--border)] bg-white"><div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:gap-8 md:py-16 lg:grid-cols-[1fr_1.55fr] lg:items-center lg:px-8"><Card treatment="primary" className="home-network-card">
          <div className="home-network-heading"><div><p className="home-network-eyebrow">Live network map</p><h2>Your journey, in view.</h2></div><span className="home-network-icon" aria-hidden="true"><MapPin size={20} /></span></div>
          <p className="home-network-description">Find bus locations, nearby stops and routes for your next journey.</p>
          <div className="home-map-summary"><Link href="/live-map" prefetch={false}><strong>{busesQuery.loading || busesQuery.isError ? "--" : liveBusCount}</strong><span>Recent GPS updates</span></Link><Link href="/routes"><strong>{transitLoading || transitError ? "--" : routes.length}</strong><span>Available routes</span></Link></div>
          <p className="home-network-status">{!online ? "Offline. Connect to check current GPS updates." : busesQuery.loading ? "Checking recent GPS updates..." : busesQuery.isError ? "GPS updates are currently unavailable." : liveBusCount === 0 ? "No recent GPS updates available." : "Recent positions are available on the map."}</p>
          <Link href="/live-map" prefetch={false} className="home-network-action">Open live network <ArrowRight size={17} aria-hidden="true" /></Link>
        </Card><div><Link href="/live-map" prefetch={false} className="public-home-map group grid min-h-[270px] place-items-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-6 text-center shadow-[0_14px_36px_rgba(15,23,42,0.08)] sm:min-h-[280px]"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-ink)] transition-transform group-hover:scale-105"><Map size={30} /></span><span className="mt-4 grid gap-1"><strong className="text-lg text-[var(--foreground)]">Open Live Map <ArrowRight className="inline" size={18} /></strong><small className="text-sm text-[var(--muted)]">Explore bus locations, route paths and nearby stops.</small></span></Link><Link href="/live-map" prefetch={false} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary-border)] bg-white text-sm font-bold text-[var(--primary-ink)] md:hidden"><MapPin size={17} /> View live map</Link></div></div></section>

      <section id="routes" data-home-reveal className="home-content-section home-routes-section mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-6 md:py-16 lg:px-8"><div className="home-section-heading flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Plan ahead</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl md:mt-2">Popular Routes</h2><p className="mt-1 text-xs text-[var(--muted)] sm:text-sm md:mt-2">Find a route for your next journey.</p></div><Link href="/routes" className="inline-flex min-h-10 flex-none items-center gap-1 text-xs font-bold text-[var(--primary-ink)] sm:text-sm">View all <ArrowRight size={15} /></Link></div>
        {transitLoading ? <div className="mt-4 py-4"><SectionSkeleton label="Loading routes" count={3} /></div> : displayedRoutes.length ? <><div className="public-route-scroll -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 md:hidden">{displayedRoutes.slice(0, 5).map((route) => <RouteCard key={getRouteId(route)} route={route} className="home-mobile-route" />)}</div><div className="mt-8 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">{displayedRoutes.slice(0, 6).map((route) => <RouteCard key={getRouteId(route)} route={route} />)}</div></> : <div className="mt-4"><EmptyState title={transitError ? "Routes are unavailable" : "No routes found"} description={transitError ? "Please try again when your connection returns." : "Try another route name, starting point, or destination."} /></div>}
      </section>

      <section data-home-reveal className="home-content-section home-benefits-section border-y"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-16 lg:px-8"><div className="max-w-xl"><p className="home-benefits-kicker text-xs font-bold uppercase tracking-[0.16em]">Why Smart Safar</p><h2 className="home-benefits-title mt-1 text-xl font-extrabold tracking-tight sm:text-3xl md:mt-2">Better information for every trip.</h2><p className="home-benefits-copy mt-2 text-sm leading-6">Clear, useful transit information designed around everyday travel in Faisalabad.</p></div><div className="mt-4 grid grid-cols-2 gap-2.5 md:mt-8 md:grid-cols-4 md:gap-4">{benefits.map(({ title, text, icon: Icon }) => <Card key={title} className={`feature-card ${title === "Live Tracking" ? "feature-card--live" : ""} p-4 md:p-5`}><span className={`feature-icon ${title === "Live Tracking" ? "feature-icon--live" : ""} grid h-9 w-9 place-items-center rounded-xl md:h-10 md:w-10`}><Icon size={18} /></span><h3 className="mt-3 text-sm font-bold text-[var(--foreground)] md:mt-5 md:text-base">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)] md:mt-2 md:text-sm md:leading-6">{text}</p></Card>)}</div></div></section>

      <section className="home-content-section home-safety-section mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-16 lg:px-8"><Card className="home-safety-card grid gap-6 overflow-hidden p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10"><div className="home-safety-content"><Badge className="home-safety-eyebrow">Built for safer journeys</Badge><h2 className="mt-4 text-3xl font-bold tracking-tight">Safer &amp; More Reliable Travel</h2><p className="home-safety-copy mt-3 max-w-2xl text-sm leading-6">Travel with better context. Women Safety helps passengers share the live location of their selected bus with trusted contacts while keeping their personal location private. Bus Trust Score reflects punctuality and historical arrival performance, while route change alerts keep you informed.</p></div><span className="home-safety-icon grid h-16 w-16 place-items-center rounded-2xl lg:mr-5"><ShieldCheck size={32} /></span></Card></section>

      <section className="home-final-cta border-t border-[var(--border)]"><div className="home-final-cta-inner mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:py-12 lg:px-8"><div><h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-2xl">Ready to plan your journey?</h2><p className="mt-1 text-sm text-[var(--muted)] md:mt-2">Find your route and track your bus with live information.</p></div><div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto"><Link href="/live-map" prefetch={false} className="home-final-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)]">Track a Bus</Link><Link href="/routes" className="home-final-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)]">View Routes</Link></div></div></section>
    </main>
    <Footer />
  </div>;
}
