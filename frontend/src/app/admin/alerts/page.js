"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { Navbar } from "../../../components/navigation/Navbar";
import { Footer } from "../../../components/navigation/Footer";
import { ProtectedPage } from "../../../components/common/ProtectedPage";
import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { EmptyState } from "../../../components/common/EmptyState";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { routeService } from "../../../services/routeService";
import { alertService } from "../../../services/alertService";

export default function AdminAlerts() { return <div className="min-h-screen bg-[var(--background)]"><Navbar /><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10"><ProtectedPage adminOnly>{() => <Alerts />}</ProtectedPage></main><Footer /></div>; }

function Alerts() {
  const [routes, setRoutes] = useState([]);
  const [route, setRoute] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [routesState, setRoutesState] = useState("loading");
  const [alertsState, setAlertsState] = useState("idle");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRoutes = useCallback(async () => {
    setRoutesState("loading"); setError("");
    try { const data = await routeService.list(); setRoutes(Array.isArray(data) ? data : data.routes || []); setRoutesState("ready"); }
    catch { setRoutesState("error"); setError("Routes could not be loaded. Please try again."); }
  }, []);
  const loadAlerts = useCallback(async () => {
    if (!route) { setAlerts([]); setAlertsState("idle"); return; }
    setAlertsState("loading"); setError("");
    try { const data = await alertService.listByRoute(route); setAlerts(Array.isArray(data) ? data : []); setAlertsState("ready"); }
    catch { setAlertsState("error"); setError("Alerts could not be loaded. Please try again."); }
  }, [route]);
  useEffect(() => { Promise.resolve().then(loadRoutes); }, [loadRoutes]);
  useEffect(() => { Promise.resolve().then(loadAlerts); }, [loadAlerts]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { await alertService.create({ route, message, ...(expiresAt && { expiresAt }) }); setMessage(""); setExpiresAt(""); await loadAlerts(); }
    catch (requestError) { setError(requestError.response?.data?.message || "The alert could not be published. Please try again."); }
    finally { setSaving(false); }
  }
  async function remove(id) {
    if (!window.confirm("Delete this route alert?")) return;
    setError("");
    try { await alertService.delete(id); setAlerts((current) => current.filter((item) => item._id !== id)); }
    catch { setError("The alert could not be deleted. Please try again."); }
  }

  return <><header><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--primary-ink)]">Passenger information</p><h1 className="mt-2 text-3xl font-bold">Route alerts</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Publish and manage current service updates using the existing route alert service.</p></header><div className="mt-7 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]"><Card className="p-5"><h2 className="text-lg font-bold">Publish an alert</h2>{routesState === "loading" ? <LoadingSpinner label="Loading routes..." /> : routesState === "error" ? <Button type="button" variant="secondary" className="mt-4 gap-2" onClick={loadRoutes}><RefreshCw size={16} /> Retry</Button> : <form onSubmit={submit} className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-semibold">Route<select className="field-input" value={route} onChange={(event) => setRoute(event.target.value)} required><option value="">Select route</option>{routes.map((item) => <option key={item._id} value={item._id}>{item.routeName}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Passenger message<textarea className="field-input min-h-28 resize-y" value={message} onChange={(event) => setMessage(event.target.value)} required placeholder="Describe the service update clearly." /></label><label className="grid gap-2 text-sm font-semibold">End time <span className="text-xs font-normal text-[var(--muted)]">(optional)</span><input type="datetime-local" className="field-input" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><Button disabled={saving}>{saving ? "Publishing..." : "Publish alert"}</Button></form>}</Card><section><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--primary-ink)]">Current updates</p><h2 className="mt-1 text-xl font-bold">Active alerts</h2></div>{route && <Button type="button" variant="secondary" onClick={loadAlerts} disabled={alertsState === "loading"} aria-label="Refresh alerts"><RefreshCw size={16} className={alertsState === "loading" ? "animate-spin" : ""} /></Button>}</div><div className="mt-4 grid gap-3">{!route ? <EmptyState title="Choose a route" description="Select a route to view its current alerts." /> : alertsState === "loading" ? <Card className="grid min-h-40 place-items-center"><LoadingSpinner label="Loading alerts..." /></Card> : alertsState === "error" ? <Card className="p-5 text-sm text-[var(--danger)]">Alerts could not be loaded. Use refresh to try again.</Card> : alerts.length ? alerts.map((alert) => <Card key={alert._id} className="border-[#f0d7aa] bg-[var(--warning-soft)] p-4"><div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" /><div className="min-w-0 flex-1"><p className="break-words text-sm leading-6 text-[var(--warning)]">{alert.message}</p><p className="mt-2 text-xs font-semibold text-[var(--warning)]">{alert.expiresAt ? `Active until ${new Date(alert.expiresAt).toLocaleString()}` : "Active until removed"}</p></div><button type="button" onClick={() => remove(alert._id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--danger)] hover:bg-[var(--danger-soft)]" aria-label="Delete alert"><Trash2 size={16} /></button></div></Card>) : <EmptyState title="No active alerts" description="There are no current alerts for this route." />}</div></section></div>{error && <p role="alert" className="mt-4 rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{error}</p>}</>;
}
