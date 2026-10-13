"use client";

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
import { CardBackdrop } from "../common/CardBackdrop";
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
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function MobileBusCard({ bus }) {
  return <Link href={`/buses/${bus.id}`} className="mobile-bus-card premium-card premium-card--operational flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.05)]">
    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]"><BusFront size={29} /></span>
    <span className="grid min-w-0 flex-1 gap-1"><strong className="truncate text-sm text-[var(--foreground)]">{bus.number}</strong><small className="truncate text-xs text-[var(--muted)]">{bus.directionLabel || bus.routeName}</small></span>
    <span className="flex-none text-right"><small className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--success)]">{bus.isSaved ? "Last known" : "Live"}</small>{bus.eta && <strong className="mt-1 block text-xs text-[var(--foreground)]">{bus.eta}</strong>}</span>
  </Link>;
}

function MobileRouteCard({ route }) {
  const routeId = route._id || route.id || route.number;
  const routeLabel = route.number || route.routeCode || "Route";
  return <article className="mobile-route-card premium-card premium-card--glass flex w-[82vw] max-w-[310px] flex-none flex-col rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,0.05)]">
    <div className="flex items-center justify-between gap-3"><span className="rounded-lg bg-[var(--primary-soft)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--primary-ink)]">{routeLabel}</span>{route.isActive !== false && <span className="mobile-route-live text-[10px] font-bold text-[var(--success)]">Active</span>}</div>
    <h3 className="mt-3 truncate text-base font-bold text-[var(--foreground)]">{route.routeName || route.name}</h3>
    <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-[1.45] text-[var(--muted)]">{route.startPoint || route.start} <ArrowRight className="inline" size={12} /> {route.endPoint || route.end}</p>
    <Link href={`/routes/${routeId}`} className="mt-3 inline-flex min-h-10 items-center gap-1 border-t border-[var(--border)] pt-3 text-xs font-bold text-[var(--primary-ink)]">View route <ArrowRight size={14} /></Link>
  </article>;
}

export default function HomePage() {
  const routesQuery = useTransitQuery(transitQueries.routes());
  const busesQuery = useTransitQuery(transitQueries.buses());
  const online = useOnline();
  const connected = useLiveConnection();
  const { enabled: dataSaver } = useDataSaver();
  const routes = routesQuery.data || [];
  const routeMap = Object.fromEntries(routes.map((route) => [getRouteId(route), route]));
  const buses = online && !busesQuery.isError ? (busesQuery.data || []).map((bus) => ({ ...normalizeBus(bus, null, routeMap), isSaved: !connected || busesQuery.isStale })) : [];
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return undefined;
    const targets = [...document.querySelectorAll("[data-home-reveal]")];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.dataset.homeReveal = "shown";
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeBuses = buses.filter(isOperating);
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
          <div className="home-hero-media relative mx-auto hidden w-full max-w-lg md:block lg:mx-0 lg:justify-self-end">
            <div className="overflow-hidden rounded-[2rem] border border-[var(--primary-border)] shadow-[0_24px_60px_rgba(15,23,42,0.15)]">
              <div className="relative h-[310px] sm:h-[360px]">
                {!dataSaver && <Image src="/smart-safar-transit-hero.webp" alt="Modern Smart Safar bus travelling through the city at sunset" fill priority sizes="(min-width: 1024px) 32rem, (min-width: 768px) 42rem, 100vw" className="object-cover" />}
                {/* Orange gradient overlay keeps the design system cohesive */}
                <div className="home-hero-overlay absolute inset-0" />
                <div className="home-hero-status absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/30 px-4 py-3 shadow-lg backdrop-blur-xl">
                  <div>
                    <p className="text-xs text-white/70">Network status</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {transitLoading ? "Checking live service..." : showingSavedTransit ? "Saved route information is available" : `${activeBuses.length} ${activeBuses.length === 1 ? "bus" : "buses"} active now`}
                    </p>
                  </div>
                  <Badge tone={activeBuses.length && !showingSavedTransit ? "success" : "neutral"}>{showingSavedTransit ? "Offline" : activeBuses.length ? "Live" : "Quiet"}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="transit-search" className="relative z-20 mx-auto max-w-5xl scroll-mt-24 px-4 pt-4 sm:px-6 md:-mt-7 md:pt-0"><Card treatment="operational" className="home-search-card p-3 sm:p-4"><form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row"><label className="flex min-h-13 flex-1 items-center gap-3 rounded-xl border border-[var(--primary-border)] bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-[var(--primary-soft-strong)]"><Search size={19} className="shrink-0 text-[var(--primary-ink)]" /><input ref={searchRef} value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setHasSearched(false); }} className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" placeholder="Route, bus or stop" aria-label="Search routes, buses or stops" /></label><button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-contrast)] hover:bg-[var(--primary-dark)]"><Search size={17} /> Find transit</button></form>{hasSearched && <p className="mt-3 border-t border-[var(--border)] px-1 pt-3 text-sm text-[var(--muted)]">{matchingBuses.length + matchingRoutes.length > 0 ? `${matchingBuses.length + matchingRoutes.length} matching transit result${matchingBuses.length + matchingRoutes.length === 1 ? "" : "s"}.` : "No matching transit found. Try a route, bus number or stop."}</p>}</Card></section>

      <section data-home-reveal className="home-quick-actions mx-auto max-w-5xl px-4 pt-4 sm:px-6 md:hidden" aria-label="Quick actions"><div className="grid grid-cols-3 gap-2"><Link href="/live-map" className="public-quick-action premium-card premium-card--glass"><span><BusFront size={19} /></span>Live Buses</Link><Link href="/routes" className="public-quick-action premium-card premium-card--glass"><span><RouteIcon size={19} /></span>Routes</Link><button type="button" onClick={focusSearch} className="public-quick-action premium-card premium-card--glass"><span><Search size={19} /></span>Find a Bus</button></div></section>

      <section id="live-transit" className="home-content-section home-live-section mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-6 md:py-16 lg:px-8"><div className="premium-card premium-card--primary premium-card--imagery flex items-end justify-between gap-4 p-4 sm:p-5"><CardBackdrop visual="transit" /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">{showingSavedTransit ? "Offline" : "Right now"}</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl md:mt-2">{showingSavedTransit ? "Saved Transit" : "Live Transit"}</h2><p className="mt-1 text-xs text-[var(--muted)] sm:text-sm md:mt-2">{showingSavedTransit ? "Routes and stops saved from your last connection." : "Buses currently operating across Faisalabad."}</p></div><Link href="/live-map" className="inline-flex min-h-10 flex-none items-center gap-1 text-xs font-bold text-[var(--primary-ink)] sm:text-sm">View all <ArrowRight size={15} /></Link></div>
        {transitLoading ? <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((key) => <SectionSkeleton key={key} label="Loading bus" count={1} />)}</div> : transitError ? <div className="mt-4"><EmptyState title="Live transit is unavailable" description="We couldn't retrieve current bus information right now." /></div> : displayedBuses.length ? <><div className="mt-4 grid gap-2.5 md:hidden">{displayedBuses.slice(0, 3).map((bus) => <MobileBusCard key={bus.id} bus={bus} />)}</div><div className="mt-8 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">{displayedBuses.slice(0, 6).map((bus) => <BusCard key={bus.id} bus={bus} />)}</div></> : <div className="mt-4"><EmptyState title={showingSavedTransit ? "Live updates are paused" : hasSearched ? "No active buses found" : "No buses operating right now"} description={showingSavedTransit ? "Connect to the internet for current bus positions and arrival times." : hasSearched ? "Try another bus number, route, or stop." : "Live details will appear when service is active."} /></div>}
      </section>

      <section className="home-content-section home-map-section border-y border-[var(--border)] bg-white"><div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:gap-8 md:py-16 lg:grid-cols-[1fr_1.55fr] lg:items-center lg:px-8"><Card visual="network" treatment="primary" className="p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Live network map</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl md:mt-2">Your journey, in view.</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Open the live map when you need real-time positions, stops and route movement.</p><div className="home-map-summary mt-5 hidden grid-cols-2 gap-2 md:grid"><Link href="/live-map" className="premium-card premium-card--stat"><strong>{transitLoading ? "--" : activeBuses.length}</strong><span>Active buses</span></Link><Link href="/routes" className="premium-card premium-card--stat"><strong>{transitLoading ? "--" : routes.length}</strong><span>Available routes</span></Link></div><Link href="/live-map" className="home-map-all-link mt-4 hidden items-center gap-2 text-sm font-bold text-[var(--primary-ink)] md:inline-flex">Open live network <ArrowRight size={16} /></Link></Card><div><Link href="/live-map" className="public-home-map group grid min-h-[270px] place-items-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-6 text-center shadow-[0_14px_36px_rgba(15,23,42,0.08)] sm:min-h-[340px] lg:min-h-[450px]"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-ink)] transition-transform group-hover:scale-105"><MapPin size={30} /></span><span className="mt-4 grid gap-1"><strong className="text-lg text-[var(--foreground)]">Open the live network</strong><small className="text-sm text-[var(--muted)]">The interactive map loads only when requested.</small></span></Link><Link href="/live-map" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary-border)] bg-white text-sm font-bold text-[var(--primary-ink)] md:hidden"><MapPin size={17} /> View live map</Link></div></div></section>

      <section id="routes" data-home-reveal className="home-content-section home-routes-section mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-6 md:py-16 lg:px-8"><div className="premium-card premium-card--primary premium-card--imagery flex items-end justify-between gap-4 p-4 sm:p-5"><CardBackdrop visual="routes" /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Plan ahead</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl md:mt-2">Popular Routes</h2><p className="mt-1 text-xs text-[var(--muted)] sm:text-sm md:mt-2">Find a route for your next journey.</p></div><Link href="/routes" className="inline-flex min-h-10 flex-none items-center gap-1 text-xs font-bold text-[var(--primary-ink)] sm:text-sm">View all <ArrowRight size={15} /></Link></div>
        {transitLoading ? <div className="mt-4 py-4"><SectionSkeleton label="Loading routes" count={3} /></div> : displayedRoutes.length ? <><div className="public-route-scroll -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 md:hidden">{displayedRoutes.slice(0, 5).map((route) => <MobileRouteCard key={getRouteId(route)} route={route} />)}</div><div className="mt-8 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">{displayedRoutes.slice(0, 6).map((route) => <RouteCard key={getRouteId(route)} route={route} />)}</div></> : <div className="mt-4"><EmptyState title="No routes found" description="Try another route name, starting point, or destination." /></div>}
      </section>

      <section data-home-reveal className="home-content-section home-benefits-section border-y"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-16 lg:px-8"><div className="max-w-xl"><p className="home-benefits-kicker text-xs font-bold uppercase tracking-[0.16em]">Why Smart Safar</p><h2 className="home-benefits-title mt-1 text-xl font-extrabold tracking-tight sm:text-3xl md:mt-2">Better information for every trip.</h2><p className="home-benefits-copy mt-2 text-sm leading-6">Clear, useful transit information designed around everyday travel in Faisalabad.</p></div><div className="mt-4 grid grid-cols-2 gap-2.5 md:mt-8 md:grid-cols-4 md:gap-4">{benefits.map(({ title, text, icon: Icon }) => <Card key={title} className={`feature-card ${title === "Live Tracking" ? "feature-card--live" : ""} p-4 md:p-5`}><span className={`feature-icon ${title === "Live Tracking" ? "feature-icon--live" : ""} grid h-9 w-9 place-items-center rounded-xl md:h-10 md:w-10`}><Icon size={18} /></span><h3 className="mt-3 text-sm font-bold text-[var(--foreground)] md:mt-5 md:text-base">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)] md:mt-2 md:text-sm md:leading-6">{text}</p></Card>)}</div></div></section>

      <section className="home-content-section home-safety-section mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-16 lg:px-8"><Card className="home-safety-card grid gap-6 overflow-hidden p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10"><div className="home-safety-content"><Badge className="home-safety-eyebrow">Built for safer journeys</Badge><h2 className="mt-4 text-3xl font-bold tracking-tight">Safer &amp; More Reliable Travel</h2><p className="home-safety-copy mt-3 max-w-2xl text-sm leading-6">Travel with better context. Women Safety helps passengers share the live location of their selected bus with trusted contacts while keeping their personal location private. Bus Trust Score reflects punctuality and historical arrival performance, while route change alerts keep you informed.</p></div><span className="home-safety-icon grid h-16 w-16 place-items-center rounded-2xl lg:mr-5"><ShieldCheck size={32} /></span></Card></section>

      <section className="home-final-cta border-t border-[var(--border)]"><div className="home-final-cta-inner mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:py-12 lg:px-8"><div><h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-2xl">Ready to plan your journey?</h2><p className="mt-1 text-sm text-[var(--muted)] md:mt-2">Find your route and track your bus with live information.</p></div><div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto"><Link href="/live-map" className="home-final-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)]">Track a Bus</Link><Link href="/routes" className="home-final-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)]">View Routes</Link></div></div></section>
    </main>
    <Footer />
  </div>;
}
