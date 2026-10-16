"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "smart-safar-theme-v1";
export const APPEARANCE_KEY = "smart-safar-appearance-v1";

const accentOptions = [
  { id: "blue", name: "Blue", detail: "Default", description: "Clear, calm transit blue" },
  { id: "orange", name: "Orange", detail: "Classic", description: "Original Smart Safar warmth" },
];
const appearanceOptions = [
  { id: "light", name: "Light", description: "Use the light interface" },
  { id: "dark", name: "Dark", description: "Use the dark interface" },
  { id: "system", name: "System", description: "Follow this device" },
];

function resolvedAppearance(preference) {
  return preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}

export function applyTheme(theme, persist = true) {
  if (typeof window === "undefined") return;
  const selected = theme === "orange" ? "orange" : "blue";
  document.documentElement.dataset.theme = selected;
  if (persist) { try { window.localStorage.setItem(THEME_KEY, selected); } catch {} }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", selected === "orange" ? "#c4510d" : "#0F5797");
  if (persist) window.dispatchEvent(new CustomEvent("smart-safar-theme-change", { detail: selected }));
}

export function applyAppearance(appearance, persist = true) {
  if (typeof window === "undefined") return;
  const selected = ["light", "dark", "system"].includes(appearance) ? appearance : "system";
  document.documentElement.dataset.appearancePreference = selected;
  document.documentElement.dataset.appearance = resolvedAppearance(selected);
  if (persist) { try { window.localStorage.setItem(APPEARANCE_KEY, selected); } catch {} }
  if (persist) window.dispatchEvent(new CustomEvent("smart-safar-appearance-change", { detail: selected }));
}

export function ThemeOptions({ selected, onSelect }) {
  return <div className="theme-choice-grid" aria-label="Colour theme">{accentOptions.map((option) => <button key={option.id} type="button" className={"theme-choice theme-choice--" + option.id} aria-pressed={selected === option.id} onClick={() => onSelect(option.id)}><span className={"theme-choice-preview theme-choice-preview--" + option.id} aria-hidden="true"><span /><span /><span /></span><strong>{option.name} <small className="inline">- {option.detail}</small></strong><small>{option.description}</small></button>)}</div>;
}

export function AppearanceOptions({ selected, onSelect }) {
  return <div className="appearance-choice-grid" aria-label="Appearance">{appearanceOptions.map((option) => <button key={option.id} type="button" className="appearance-choice" aria-pressed={selected === option.id} onClick={() => onSelect(option.id)}><strong>{option.name}</strong><small>{option.description}</small></button>)}</div>;
}

export function AppearancePreference() {
  useEffect(() => {
    let preference = "system";
    try { const saved = window.localStorage.getItem(APPEARANCE_KEY); if (["light", "dark", "system"].includes(saved)) preference = saved; } catch {}
    applyAppearance(preference, false);
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemAppearance = () => { if (document.documentElement.dataset.appearancePreference === "system") applyAppearance("system", false); };
    query.addEventListener("change", updateSystemAppearance);
    return () => query.removeEventListener("change", updateSystemAppearance);
  }, []);
  return null;
}

export function ThemeOnboarding() {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState("blue");
  useEffect(() => {
    let saved = null; try { saved = window.localStorage.getItem(THEME_KEY); } catch {}
    if (saved !== "blue" && saved !== "orange") queueMicrotask(() => setVisible(true)); else applyTheme(saved, false);
    const changed = () => setVisible(false);
    const storageChanged = (event) => { if (event.key !== THEME_KEY) return; const theme = event.newValue === "orange" ? "orange" : "blue"; applyTheme(theme, false); setSelected(theme); setVisible(event.newValue !== "blue" && event.newValue !== "orange"); };
    window.addEventListener("storage", storageChanged); window.addEventListener("smart-safar-theme-change", changed);
    return () => { window.removeEventListener("storage", storageChanged); window.removeEventListener("smart-safar-theme-change", changed); };
  }, []);
  if (!visible) return null;
  function choose(theme) { setSelected(theme); applyTheme(theme, false); }
  function finish(theme) { applyTheme(theme); setVisible(false); }
  return <section className="theme-onboarding" aria-labelledby="theme-onboarding-title"><h2 id="theme-onboarding-title">Choose your Smart Safar theme</h2><p>Make the app feel like yours. You can switch later in Settings.</p><ThemeOptions selected={selected} onSelect={choose} /><div className="theme-onboarding-actions"><button type="button" className={selected === "blue" ? "is-selected" : undefined} onClick={() => finish("blue")}>Continue with Blue</button><button type="button" className={selected === "orange" ? "is-selected" : undefined} onClick={() => finish("orange")}>Continue with Orange</button></div></section>;
}
