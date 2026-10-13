"use client";

import Link from "../common/SmartLink";
import { BusFront, ArrowRight, BellRing, Flag, MapPinned, Route as RouteIcon, UserRoundCheck } from "lucide-react";
import { Card } from "../common/Card";

const links = [
  { label: "Driver Management", description: "Manage driver accounts", href: "/admin/users", icon: UserRoundCheck },
  { label: "Add Bus", description: "Open fleet management", href: "/admin/buses", icon: BusFront },
  { label: "Manage Routes", description: "Create and update routes", href: "/admin/routes", icon: RouteIcon },
  { label: "Add Stop", description: "Open stop management", href: "/admin/stops?action=add", icon: MapPinned },
  { label: "Alerts", description: "Publish service updates", href: "/admin/alerts", icon: BellRing },
  { label: "Reports", description: "Review reported issues", href: "/admin/reports", icon: Flag },
];

export function QuickActions() {
  return <Card treatment="glass" className="flex h-full flex-col p-5"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--primary-ink)]">Management</p><h2 className="mt-1 text-lg font-bold">Quick actions</h2><p className="mt-1 text-xs text-[var(--muted)]">Open frequently used admin tools.</p></div><div className="mt-5 grid flex-1 auto-rows-fr grid-cols-2 gap-3">{links.map(({ label, description, href, icon: Icon }) => <Link key={href} href={href} className="group flex min-h-24 min-w-0 flex-col justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-ink)]"><Icon size={19} /></span><span className="mt-4 flex items-end justify-between gap-2"><span className="min-w-0"><strong className="block text-sm">{label}</strong><small className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">{description}</small></span><ArrowRight size={15} className="shrink-0 text-[var(--primary-ink)]" /></span></Link>)}</div></Card>;
}
