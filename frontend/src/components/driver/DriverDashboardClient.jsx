"use client";
import { usePathname } from "next/navigation";
import DriverDashboardPage from "./DriverDashboardPage";
const views = { dashboard: "overview", shift: "shift", route: "route", tracking: "tracking", seats: "seats" };
export default function DriverDashboardClient() {
  const pathname = usePathname();
  return <DriverDashboardPage view={views[pathname.split("/").pop()] || "overview"} />;
}
