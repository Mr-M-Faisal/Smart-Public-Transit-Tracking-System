"use client";

import { useEffect, useState } from "react";
import { Navbar } from "../../components/navigation/Navbar";
import { Footer } from "../../components/navigation/Footer";
import { ProtectedPage } from "../../components/common/ProtectedPage";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { busService } from "../../services/busService";
import { reportService } from "../../services/reportService";

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <ProtectedPage>{(user) => <ReportForm key={user._id} user={user} />}</ProtectedPage>
      </main>
      <Footer />
    </div>
  );
}

function ReportForm({ user }) {
  const assignedBus = user.role === "driver" ? user.assignedBus?._id || user.assignedBus || "" : "";
  const [buses, setBuses] = useState([]);
  const [form, setForm] = useState({ bus: assignedBus, reportType: "condition", description: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    busService.list().then((result) => {
      if (active) { setBuses(result); setLoadError(false); }
    }).catch(() => {
      if (active) setLoadError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [retry]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    if (!form.description.trim()) { setError("Enter a description of the issue."); return; }
    setBusy(true);
    try {
      await reportService.create({ ...form, description: form.description.trim() });
      setMessage("Your report has been submitted for review.");
      setForm({ bus: assignedBus, reportType: "condition", description: "" });
    } catch {
      setError("Unable to submit your report. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card visual={user.role === "driver" ? undefined : "reports"} treatment={user.role === "driver" ? "operational" : "primary"} className={user.role === "driver" ? "driver-report-heading p-5" : "p-5 sm:p-6"}><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--primary-ink)]">{user.role === "driver" ? "Driver operations" : "Passenger feedback"}</p>
      <h1 className="mt-2 text-3xl font-bold">Report an issue</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">Submit a bus condition or safety report for the transit team to review.</p></Card>
      {loading ? <div className="mt-6"><LoadingSpinner label="Loading buses..." /></div> : loadError ? <div role="alert" className="mt-6"><p className="text-sm text-[var(--danger)]">Unable to load buses.</p><Button type="button" className="mt-3 min-h-11" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Try again</Button></div> : !buses.length ? <p className="mt-6 text-sm text-[var(--muted)]">No buses are available to report.</p> : (
        <form onSubmit={submit} className="premium-card premium-card--operational mt-5 grid gap-4 p-5 sm:p-6">
          <label htmlFor="report-bus" className="grid gap-2 text-sm font-semibold">Bus
            <select id="report-bus" className="field-input" value={form.bus} onChange={(event) => setForm({ ...form, bus: event.target.value })} required disabled={busy}>
              <option value="">Select a bus</option>
              {buses.map((bus) => <option key={bus._id} value={bus._id}>{bus.busNumber}</option>)}
            </select>
          </label>
          <label htmlFor="report-type" className="grid gap-2 text-sm font-semibold">Report type
            <select id="report-type" className="field-input" value={form.reportType} onChange={(event) => setForm({ ...form, reportType: event.target.value })} disabled={busy}>
              <option value="condition">Bus condition</option><option value="safety">Safety</option>
            </select>
          </label>
          <label htmlFor="report-description" className="grid gap-2 text-sm font-semibold">Description
            <textarea id="report-description" className="field-input min-h-32" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required disabled={busy} />
          </label>
          <Button type="submit" disabled={busy} className="min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">{busy ? "Submitting..." : "Submit report"}</Button>
          {message && <p role="status" className="text-sm text-[var(--success)]">{message}</p>}
          {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        </form>
      )}
    </>
  );
}
