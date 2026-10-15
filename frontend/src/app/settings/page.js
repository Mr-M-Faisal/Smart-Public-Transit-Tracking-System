"use client";

import Link from "../../components/common/SmartLink";
import { useEffect, useState } from "react";
import { ArrowRight, CircleUserRound, FileText, LogOut, Palette, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { Navbar } from "../../components/navigation/Navbar";
import { Footer } from "../../components/navigation/Footer";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { ProtectedPage } from "../../components/common/ProtectedPage";
import { ThemeOptions, THEME_KEY, applyTheme } from "../../components/common/ThemePicker";
import { DataSaverOptions } from "../../components/common/DataSaverControl";
import { clearAccessToken } from "../../lib/auth/token";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  return <div className="min-h-screen bg-[var(--background)]"><Navbar /><main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10"><ProtectedPage fallback={<SettingsSkeleton />}>{(user) => <SettingsContent user={user} />}</ProtectedPage></main><Footer /></div>;
}

function SettingsContent({ user }) {
  const router = useRouter();
  const [theme, setTheme] = useState("blue");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const reportHref = user.role === "admin" ? "/admin/reports" : "/reports";
  const initials = user.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SS";

  useEffect(() => {
    let selected = document.documentElement.dataset.theme === "orange" ? "orange" : "blue";
    try { const saved = window.localStorage.getItem(THEME_KEY); if (saved === "blue" || saved === "orange") selected = saved; } catch { /* Use the active theme. */ }
    queueMicrotask(() => setTheme(selected));
    const onTheme = (event) => setTheme(event.detail === "orange" ? "orange" : "blue");
    window.addEventListener("smart-safar-theme-change", onTheme);
    return () => window.removeEventListener("smart-safar-theme-change", onTheme);
  }, []);

  function selectTheme(value) { applyTheme(value); setTheme(value); }
  function logout() { clearAccessToken(); router.replace("/"); }

  return <div className="settings-page">
    <header className="settings-page__header"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--primary-ink)]">Account preferences</p><h1>Settings</h1><p>Manage your profile, appearance, and how Smart Safar uses data on this device.</p></header>

    <div className="settings-page__grid">
      <div className="grid gap-5">
        <SettingsSection icon={UserRound} eyebrow="Profile" title="Your account" description="Your current Smart Safar account information.">
          <div className="settings-profile-row"><span className="settings-avatar">{initials}</span><div className="min-w-0 flex-1"><strong>{user.name}</strong><span>{user.email}</span><small>{user.role ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)} account` : "Smart Safar account"}</small></div><Link href="/profile" className="settings-inline-link">Edit profile <ArrowRight size={15} /></Link></div>
        </SettingsSection>

        <SettingsSection icon={Palette} eyebrow="Appearance" title="Colour theme" description={`Currently using ${theme === "orange" ? "Orange" : "Blue"}. Changes apply immediately and stay saved on this device.`}>
          <ThemeOptions selected={theme} onSelect={selectTheme} />
        </SettingsSection>

        <SettingsSection icon={SlidersHorizontal} eyebrow="Data Saver" title="Use less data when it matters" description="Data Saver only changes nonessential visuals and background work. Booking, GPS, security, and live updates remain available.">
          <DataSaverOptions />
        </SettingsSection>
      </div>

      <aside className="grid content-start gap-5">
        <SettingsSection icon={FileText} eyebrow="Reports & support" title="Need help?" description="Use the existing report flow to send an issue to the Smart Safar team.">
          <Link href={reportHref} className="settings-action-link"><span>Report an issue</span><ArrowRight size={17} /></Link>
          <a href="mailto:help@smarttransit.pk" className="settings-action-link"><span>Contact transit support</span><ArrowRight size={17} /></a>
        </SettingsSection>

        <SettingsSection icon={ShieldCheck} eyebrow="Account" title="Session & access" description="Your permissions and transport assignments are checked by Smart Safar each time you use protected features.">
          <Button type="button" variant="secondary" className="w-full gap-2 text-[var(--danger)]" onClick={() => setConfirmLogout(true)}><LogOut size={16} /> Log out</Button>
        </SettingsSection>
      </aside>
    </div>

    {confirmLogout && <div className="app-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmLogout(false); }}><section className="settings-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-logout-title"><CircleUserRound size={24} className="text-[var(--primary-ink)]" /><h2 id="settings-logout-title">Log out of Smart Safar?</h2><p>You will need to sign in again to manage bookings and account features.</p><div><Button type="button" variant="secondary" onClick={() => setConfirmLogout(false)}>Cancel</Button><Button type="button" variant="danger" onClick={logout}>Log out</Button></div></section></div>}
  </div>;
}

function SettingsSection({ icon: Icon, eyebrow, title, description, children }) {
  return <Card treatment="operational" className="settings-section p-5 sm:p-6"><div className="flex gap-3"><span className="settings-section__icon"><Icon size={19} /></span><div><p>{eyebrow}</p><h2>{title}</h2><span>{description}</span></div></div><div className="mt-5">{children}</div></Card>;
}

function SettingsSkeleton() { return <div className="mx-auto max-w-5xl"><div className="h-4 w-32 animate-pulse rounded bg-[var(--skeleton)]" /><div className="mt-3 h-10 w-48 animate-pulse rounded bg-[var(--skeleton)]" /><div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">{Array.from({ length: 4 }, (_, index) => <Card key={index} className="h-48 animate-pulse bg-[var(--skeleton)]" />)}</div></div>; }