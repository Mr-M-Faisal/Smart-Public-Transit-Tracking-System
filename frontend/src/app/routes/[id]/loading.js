import { LoadingPageShell } from "../../../components/common/LoadingPageShell";
import { RouteDetailsSkeleton } from "../../../components/route/RouteDetailsSkeleton";
export default function Loading() { return <LoadingPageShell><div className="mx-auto max-w-7xl px-4 py-8"><RouteDetailsSkeleton /></div></LoadingPageShell>; }
