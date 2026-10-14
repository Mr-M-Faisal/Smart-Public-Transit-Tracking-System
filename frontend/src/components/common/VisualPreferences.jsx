"use client";

import { useEffect } from "react";
import { useDataSaver } from "../../hooks/useDataSaver";

// A single document-level subscriber keeps visual preferences current across
// navigation and network changes, without rerendering the page subtree.
export function VisualPreferences() {
  const { enabled, ready } = useDataSaver();
  useEffect(() => {
    if (ready) document.documentElement.dataset.dataSaver = enabled ? "on" : "off";
    const limitedMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const limitedCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    document.documentElement.dataset.lightEffects = String(Boolean(limitedMemory || limitedCores));
  }, [enabled, ready]);
  return null;
}
