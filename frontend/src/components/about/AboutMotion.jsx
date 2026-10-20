"use client";
import { useEffect } from "react";
import { useDataSaver } from "../../hooks/useDataSaver";
import { observeAboutSections } from "../../lib/aboutMotion";
export function AboutMotion() {
 const { enabled, ready } = useDataSaver();
 useEffect(() => {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!ready || enabled || preference.matches) return;
  const stop = observeAboutSections(document.querySelector(".about-premium"), window.IntersectionObserver);
  const changed = () => { if (preference.matches) stop(); };
  preference.addEventListener("change", changed);
  return () => { stop(); preference.removeEventListener("change", changed); };
 }, [enabled, ready]);
 return null;
}
