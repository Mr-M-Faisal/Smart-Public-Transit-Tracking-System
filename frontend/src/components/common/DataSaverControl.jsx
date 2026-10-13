"use client";
import { useEffect } from "react";
import { useDataSaver } from "../../hooks/useDataSaver";
export function DataSaverControl() {
  const { mode, enabled, setMode } = useDataSaver();
  useEffect(() => { document.documentElement.dataset.dataSaver = enabled ? "on" : "off"; }, [enabled]);
  return <label className="flex items-center gap-2 text-xs text-[var(--muted)]">Data Saver<select aria-label="Data Saver" value={mode} onChange={(event) => setMode(event.target.value)} className="rounded border border-[var(--border)] bg-[var(--card)] p-2"><option value="automatic">Automatic</option><option value="on">On</option><option value="off">Off</option></select></label>;
}
