"use client";
import Link from "next/link";
import { markOfflineNavigation } from "../../lib/pwa/launch";
import { useDataSaver } from "../../hooks/useDataSaver";
export default function SmartLink({ prefetch, onNavigate, ...props }) {
  const { enabled } = useDataSaver();
  return <Link {...props} onNavigate={(event) => { let prevented = false; onNavigate?.({ ...event, preventDefault() { prevented = true; event.preventDefault(); } }); if (!prevented) markOfflineNavigation(typeof props.href === "string" ? props.href : props.href?.pathname); }} prefetch={enabled ? false : prefetch} />;
}
