"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { RouteCard } from "../route/RouteCard";
import { RouteCardSkeleton } from "../route/RouteCardSkeleton";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { useTransitQuery } from "../../hooks/useTransitQuery";
import { transitQueries } from "../../lib/query/transitQueries";
import { CacheStatus } from "../common/CacheStatus";


export default function RoutesPage() {
  const routesQuery = useTransitQuery(transitQueries.routes());
  const routes = routesQuery.data || [];
  const [searchTerm, setSearchTerm] = useState("");
  const loading = routesQuery.loading;
  const error = routesQuery.isError && !routesQuery.data;

  const query = searchTerm.trim().toLowerCase();
  const filteredRoutes = routes.filter((route) => {
    const searchableText = [
      route.routeName,
      route.routeCode,
      route.number,
      route.startPoint,
      route.endPoint,
      route.description,
      ...(route.stops || []).map((stop) => stop.name || stop.stopName),
    ].filter(Boolean).join(" ").toLowerCase();
    return searchableText.includes(query);
  });

  return <div className="min-h-screen overflow-x-hidden bg-[var(--background)]"><Navbar /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Plan your journey</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">Explore Faisalabad routes.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Find routes, stops and active buses to plan your next journey.</p></header>

    <CacheStatus query={routesQuery} /><Card className="mt-6 p-2 sm:p-3"><label className="route-search-field"><Search size={19} className="shrink-0 text-[var(--primary-ink)]" /><span className="sr-only">Search routes</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search routes, stops or destinations..." /></label></Card>

    {!loading && !error && <div className="mt-8 flex items-center justify-between gap-4"><div><p className="text-2xl font-bold text-[var(--foreground)]">{routes.length}</p><p className="text-sm text-[var(--muted)]">{routes.length === 1 ? "Route" : "Routes"} available</p></div>{query && <p className="text-sm text-[var(--muted)]">Showing {filteredRoutes.length} result{filteredRoutes.length === 1 ? "" : "s"}</p>}</div>}

    <section className="mt-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Browse the network</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)]">All Routes</h2></div></div>{loading ? <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <RouteCardSkeleton key={index} />)}</div> : error ? <div className="mt-6"><ErrorState title="Unable to load routes" description="We couldn't retrieve the transit routes right now." action={<Button type="button" variant="secondary" onClick={() => routesQuery.refetch()}>Try again</Button>} /></div> : filteredRoutes.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredRoutes.map((route) => <RouteCard key={route._id || route.id || route.routeName} route={route} />)}</div> : <div className="mt-6"><EmptyState title="No routes found" description="Try searching by route number, route name or stop." action={<Button type="button" variant="secondary" onClick={() => setSearchTerm("")}>Clear search</Button>} /></div>}</section></main><Footer /></div>;
}
