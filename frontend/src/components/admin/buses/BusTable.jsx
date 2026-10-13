"use client";

import Link from "../../common/SmartLink";
import { Edit3, Trash2, User } from "lucide-react";
import { Badge } from "../../common/Badge";
import { Button } from "../../common/Button";
import { Card } from "../../common/Card";
import { EmptyState } from "../../common/EmptyState";
import { LoadingSpinner } from "../../common/LoadingSpinner";

const statusTones = { active: "success", idle: "warning", maintenance: "danger" };

export function BusTable({ buses, loading, onEdit, onDelete, onAssign, onUnassign, onAddClick, editDisabled }) {
  if (loading) return <Card className="grid min-h-48 place-items-center p-5"><LoadingSpinner label="Loading fleet buses..." /></Card>;
  if (!buses.length) return <EmptyState title="No buses found" description="No buses were returned or matched the current filters." action={onAddClick && <Button className="min-h-12" onClick={onAddClick}>Add Bus</Button>} />;
  const actions = (bus) => <div className="flex flex-wrap gap-2">
    <Button type="button" variant="secondary" className="min-h-11 gap-1.5 px-3 text-xs" aria-label={(bus.driver ? "Change driver for bus " : "Assign driver to bus ") + bus.busNumber} onClick={() => onAssign(bus)}><User size={14} aria-hidden="true" />{bus.driver ? "Change Driver" : "Assign Driver"}</Button>
    {bus.driver && <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs" aria-label={"Unassign driver from bus " + bus.busNumber} onClick={() => onUnassign(bus)}>Unassign</Button>}
    <Button type="button" variant="secondary" className="min-h-11 gap-1.5 px-3 text-xs" disabled={editDisabled} aria-label={"Edit bus " + bus.busNumber} onClick={() => onEdit(bus)}><Edit3 size={14} aria-hidden="true" />Edit</Button>
    <Button type="button" variant="secondary" className="min-h-11 gap-1.5 px-3 text-xs text-[var(--danger)]" aria-label={"Delete bus " + bus.busNumber} onClick={() => onDelete(bus)}><Trash2 size={14} aria-hidden="true" />Delete</Button>
  </div>;
  const driver = (bus) => <><p className="break-words font-semibold">{bus.driver?.name || (bus.driver ? "Driver name unavailable" : "No driver assigned")}</p>{bus.driver?.phone && <p className="mt-1 break-words text-xs text-[var(--muted)]">{bus.driver.phone}</p>}<Badge className="mt-2" tone={bus.driver ? "success" : "neutral"}>{bus.driver ? "Assigned" : "Unassigned"}</Badge></>;
  return <>
    <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-white xl:block"><table className="w-full table-fixed text-left text-sm"><thead className="bg-[var(--primary-soft)] text-xs text-[var(--muted)]"><tr><th scope="col" className="p-4">Bus</th><th scope="col" className="p-4">Route</th><th scope="col" className="p-4">Assigned driver</th><th scope="col" className="w-28 p-4">Status</th><th scope="col" className="w-28 p-4">Available seats</th><th scope="col" className="w-64 p-4">Actions</th></tr></thead><tbody>{buses.map((bus) => <tr key={bus._id} className="border-t border-[var(--border)] align-top"><td className="p-4"><Link href={"/buses/" + bus._id} className="break-words font-bold text-[var(--primary-ink)]">{bus.busNumber}</Link><p className="mt-2 break-all text-xs text-[var(--muted)]">{bus._id}</p></td><td className="break-words p-4">{bus.route?._id ? <Link href={"/routes/" + bus.route._id} className="font-semibold text-[var(--primary-ink)]">{bus.route.routeName}</Link> : "Unavailable"}</td><td className="p-4">{driver(bus)}</td><td className="p-4"><Badge tone={statusTones[bus.status] || "neutral"}>{bus.status || "Unavailable"}</Badge></td><td className="p-4">{bus.availableSeats ?? "Unavailable"} / {bus.capacity ?? "Unavailable"}</td><td className="p-4">{actions(bus)}</td></tr>)}</tbody></table></div>
    <div className="grid gap-4 md:grid-cols-2 xl:hidden">{buses.map((bus) => <Card key={bus._id} className="min-w-0 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><Link href={"/buses/" + bus._id} className="break-words text-xl font-bold text-[var(--primary-ink)]">{bus.busNumber}</Link><Badge tone={statusTones[bus.status] || "neutral"}>{bus.status || "Unavailable"}</Badge></div><p className="mt-2 break-all text-xs text-[var(--muted)]">Bus ID: {bus._id}</p><dl className="mt-4 grid gap-4 text-sm"><div><dt className="text-[var(--muted)]">Route</dt><dd className="mt-1 break-words font-semibold">{bus.route?.routeName || "Unavailable"}</dd></div><div><dt className="text-[var(--muted)]">Assigned driver</dt><dd className="mt-1">{driver(bus)}</dd></div><div><dt className="text-[var(--muted)]">Available seats / Capacity</dt><dd className="mt-1 font-semibold">{bus.availableSeats ?? "Unavailable"} / {bus.capacity ?? "Unavailable"}</dd></div></dl><div className="mt-5 border-t border-[var(--border)] pt-4">{actions(bus)}</div></Card>)}</div>
  </>;
}
