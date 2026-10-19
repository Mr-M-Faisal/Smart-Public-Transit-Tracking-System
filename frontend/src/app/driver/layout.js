import DriverDashboardClient from "../../components/driver/DriverDashboardClient";
// This layout survives driver route changes: one operations state and GPS owner.
export default function DriverLayout({ children }) { return <><DriverDashboardClient />{children}</>; }
