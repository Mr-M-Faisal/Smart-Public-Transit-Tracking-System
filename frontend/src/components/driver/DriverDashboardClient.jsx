"use client";

import DriverDashboardPage from "./DriverDashboardPage";

export default function DriverDashboardClient({ view = "overview" }) {
  return <DriverDashboardPage view={view} />;
}
