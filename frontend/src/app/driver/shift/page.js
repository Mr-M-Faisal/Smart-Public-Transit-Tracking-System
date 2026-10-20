import { redirect } from "next/navigation";

// Compatibility only: the persistent driver layout retains authorization and GPS ownership.
export default function DriverShiftRoute() { redirect("/driver/dashboard"); }
