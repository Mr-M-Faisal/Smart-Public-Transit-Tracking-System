import { LoadingPageShell } from "../../../components/common/LoadingPageShell";
import { BusDetailsSkeleton } from "../../../components/bus/BusDetailsSkeleton";
export default function Loading() { return <LoadingPageShell><div className="mx-auto max-w-7xl px-4 py-8"><BusDetailsSkeleton /></div></LoadingPageShell>; }
