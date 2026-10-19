"use client";
import Link from "../common/SmartLink";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Info, Palette, SlidersHorizontal, UserRound } from "lucide-react";
import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { ProtectedPage } from "../common/ProtectedPage";
import { BrandMark } from "../common/BrandMark";
import { AppearanceOptions, APPEARANCE_KEY, ThemeOptions, THEME_KEY, applyAppearance, applyTheme } from "../common/ThemePicker";
import { DataSaverOptions } from "../common/DataSaverControl";

export default function SettingsScreen({ section = "main", version }) {
  return <div className="min-h-screen bg-[var(--background)]"><Navbar /><main className="native-settings mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"><ProtectedPage>{user => <SettingsContent user={user} section={section} version={version} />}</ProtectedPage></main><Footer /></div>;
}
function SettingsContent({ user, section, version }) {
  const titles = { main: "Settings", appearance: "Appearance", "data-saver": "Data Saver", about: "About Smart Safar" };
  return <>
    <header className="native-settings__header">{section !== "main" && <Link href="/settings" aria-label="Back to Settings"><ArrowLeft size={20} /></Link>}<h1>{titles[section]}</h1></header>
    {section === "main" ? <>
      <Link href="/profile" className="native-settings__profile"><span className="settings-avatar">{user.name?.slice(0, 1).toUpperCase() || "S"}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><ChevronRight size={18} /></Link>
      <SettingsGroup title="Account"><SettingsRow href="/profile" icon={UserRound} title="Profile" description="View and edit your account" /></SettingsGroup>
      <SettingsGroup title="Personalization"><SettingsRow href="/settings/appearance" icon={Palette} title="Appearance" description="Light, dark and accent colours" /><SettingsRow href="/settings/data-saver" icon={SlidersHorizontal} title="Data Saver" description="Control nonessential data use" /></SettingsGroup>
      <SettingsGroup title="Help"><SettingsRow href={user.role === "admin" ? "/admin/reports" : "/reports"} icon={FileText} title="Report an issue" /><SettingsRow href="/settings/about" icon={Info} title="About Smart Safar" /></SettingsGroup>
    </> : <section className="native-settings__detail">
      {section === "appearance" && <AppearanceSettings />}
      {section === "data-saver" && <><p className="mb-5 text-sm text-[var(--muted)]">Reduce nonessential visuals and background work. Booking, GPS and live updates remain available.</p><DataSaverOptions /></>}
      {section === "about" && <div className="grid justify-items-center gap-3 text-center"><BrandMark size={80} /><h2 className="text-lg font-bold">Smart Safar</h2><p className="text-sm text-[var(--muted)]">Smart Public Transit for Faisalabad</p>{version && <p className="text-sm">Version {version}</p>}</div>}
    </section>}
  </>;
}
function SettingsGroup({ title, children }) {
  return <section className="native-settings__group"><h2>{title}</h2><div>{children}</div></section>;
}
function SettingsRow({ href, icon: Icon, title, description }) {
  return <Link href={href} className="native-settings__row"><Icon size={20} aria-hidden="true" /><span><strong>{title}</strong>{description && <small>{description}</small>}</span><ChevronRight size={17} aria-hidden="true" /></Link>;
}
function AppearanceSettings() {
  const [theme, setTheme] = useState("blue");
  const [appearance, setAppearance] = useState("system");
  useEffect(() => {
    let selected = document.documentElement.dataset.theme === "orange" ? "orange" : "blue";
    try { const saved = window.localStorage.getItem(THEME_KEY); if (saved === "blue" || saved === "orange") selected = saved; } catch { /* Use the active theme. */ }
    queueMicrotask(() => setTheme(selected));
    const onTheme = (event) => setTheme(event.detail === "orange" ? "orange" : "blue");
    let savedAppearance = "system";
    try { const saved = window.localStorage.getItem(APPEARANCE_KEY); if (["light", "dark", "system"].includes(saved)) savedAppearance = saved; } catch {}
    queueMicrotask(() => setAppearance(savedAppearance));
    const onAppearance = (event) => setAppearance(["light", "dark", "system"].includes(event.detail) ? event.detail : "system");
    window.addEventListener("smart-safar-theme-change", onTheme);
    window.addEventListener("smart-safar-appearance-change", onAppearance);
    return () => {
      window.removeEventListener("smart-safar-theme-change", onTheme);
      window.removeEventListener("smart-safar-appearance-change", onAppearance);
    };
  }, []);

  function selectTheme(value) { applyTheme(value); setTheme(value); }
  function selectAppearance(value) { applyAppearance(value); setAppearance(value); }

  return <div className="settings-appearance-stack"><AppearanceOptions selected={appearance} onSelect={selectAppearance} /><ThemeOptions selected={theme} onSelect={selectTheme} /></div>;
}
