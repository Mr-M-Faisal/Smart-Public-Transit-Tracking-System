"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "../common/SmartLink";
import { usePathname, useRouter } from "next/navigation";
import { BusFront, Bell, ChartNoAxesCombined, History, House, LogOut, MapPinned, MoreHorizontal, Route, Settings, Ticket, UserRound, Users, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { clearAccessToken, getAccessToken } from "../../lib/auth/token";
import { getCachedProfile, getProfile, getRoleHome } from "../../services/authService";
import { clearPrivateSnapshots } from "../../lib/live-map/liveMapStorage";
import { alertService } from "../../services/alertService";
import { ProfileContext } from "../../hooks/useProfileContext";
import { PageSkeleton } from "../common/SectionSkeleton";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { BrandMark } from "../common/BrandMark";
import { PwaInstallAction } from "../pwa/PwaInstallAction";

const commuter = [
  { href: "/", label: "Home", icon: House },
  { href: "/live-map", label: "Live Buses", shortLabel: "Buses", icon: BusFront },
  { href: "/routes", label: "Routes", icon: Route },
  { href: "/booking", label: "Bookings", icon: Ticket },
  { href: "/my-trips", label: "My Trips", icon: History },
];
const driver = [
  { href: "/driver/dashboard", label: "Home", icon: House },
  { href: "/driver/shift", label: "Shift", icon: History },
  { href: "/driver/route", label: "Route", icon: MapPinned },
  { href: "/driver/tracking", label: "Track", icon: BusFront },
  { href: "/driver/seats", label: "Seats", icon: Ticket },
  { href: "/reports", label: "Reports", icon: ChartNoAxesCombined },
];
const admin = [
  { href: "/admin/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/admin/buses", label: "Buses", icon: BusFront },
  { href: "/admin/routes", label: "Routes", icon: Route },
  { href: "/admin/users", label: "Driver Management", shortLabel: "Drivers", icon: Users },
  { href: "/admin/stops", label: "Stops", icon: MapPinned },
  { href: "/admin/alerts", label: "Alerts", icon: Bell },
  { href: "/admin/reports", label: "Reports", icon: ChartNoAxesCombined },

];

const SEEN_ALERTS_PREFIX = "smart-safar:seen-alerts:";

function alertIdentity(alert) {
  const id = alert?._id || alert?.id;
  return id ? String(id) : null;
}

function readSeenAlertIds(userId, refreshVersion) {
  void refreshVersion;
  if (typeof window === "undefined" || !userId) return new Set();
  try {
    const saved = JSON.parse(window.localStorage.getItem(`${SEEN_ALERTS_PREFIX}${userId}`) || "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function markAlertsSeen(userId, alerts) {
  if (typeof window === "undefined" || !userId || !alerts.length) return false;
  try {
    const seen = readSeenAlertIds(userId);
    const ids = alerts.map(alertIdentity).filter(Boolean);
    let changed = false;
    ids.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        changed = true;
      }
    });
    if (changed) window.localStorage.setItem(`${SEEN_ALERTS_PREFIX}${userId}`, JSON.stringify([...seen].slice(-300)));
    return changed;
  } catch {
    // Storage can be unavailable in privacy-restricted browsers; alerts still open normally.
    return false;
  }
}

function motionSafeScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function Navigation({ items, pathname, activeHash, onNavigate, onMore, moreOpen = false, mobile = false }) {
  return <nav aria-label={mobile ? "Mobile app navigation" : "Application navigation"} className={mobile ? "app-bottom-nav" : "app-desktop-nav"}>
    {items.map(({ href, label, shortLabel, icon: Icon, action }) => {
      if (action === "more") return <button key={action} type="button" onClick={(event) => onMore?.(event)} aria-expanded={moreOpen} className={moreOpen ? "app-nav-link is-active" : "app-nav-link"}><Icon size={mobile ? 20 : 18} /><span>{label}</span></button>;
      const [path, fragment] = href.split("#");
      const sameSection = items.some((item) => item.href?.startsWith(path + "#"));
      const active = fragment
        ? pathname === path && activeHash === `#${fragment}`
        : (!activeHash || !sameSection) && (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/"));
      return <Link key={href} href={href} onClick={(event) => onNavigate?.(event, href)} aria-current={active ? "page" : undefined} className={active ? "app-nav-link is-active" : "app-nav-link"}><Icon size={mobile ? 20 : 18} /><span>{mobile && shortLabel ? shortLabel : label}</span></Link>;
    })}
  </nav>;
}function allowed(path, role) {
  if (path.startsWith("/admin")) return role === "admin";
  if (path.startsWith("/driver")) return role === "driver";
  if (path.startsWith("/booking") || path.startsWith("/my-trips") || path === "/safety") return role === "commuter";
  if (path === "/reports") return role === "driver" || role === "commuter";
  return true;
}

export function AppExperience({ children }) {
  const { token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState({ token: null, user: null, error: "" });
  const [retry, setRetry] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [driverMoreOpen, setDriverMoreOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [activeHash, setActiveHash] = useState("");
  const [notifications, setNotifications] = useState({ status: "idle", items: [] });
  const [seenVersion, setSeenVersion] = useState(0);
  const accountRef = useRef(null);
  const notificationsRef = useRef(null);
  const notificationsOpenRef = useRef(false);
  const notificationRequestRef = useRef(false);
  const notificationOwnerRef = useRef("");
  const driverMoreRef = useRef(null);
  const driverMoreTriggerRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    let freshProfileApplied = false;
    // A token-scoped IndexedDB snapshot can restore the shell while the
    // authoritative profile refresh runs. It never grants access on its own:
    // protected mutations remain authenticated by the backend.
    getCachedProfile(token).then((cachedUser) => {
      if (active && cachedUser && !freshProfileApplied) setProfile({ token, user: cachedUser, error: "", offline: true });
    });
    getProfile().then(user => { freshProfileApplied = true; if (active) { const nextOwner = user?._id || user?.id || user?.email || ""; if (notificationOwnerRef.current !== nextOwner) { notificationOwnerRef.current = nextOwner; setNotifications({ status: "idle", items: [] }); } setProfile({ token, user, error: "" }); } }).catch(async (error) => {
      freshProfileApplied = true;
      if (!active) return;
      if (![401, 403].includes(error.response?.status) && typeof navigator !== "undefined" && !navigator.onLine) {
        const cachedUser = await getCachedProfile(token);
        if (active && cachedUser) { setProfile({ token, user: cachedUser, error: "", offline: true }); return; }
      }
      if (active) setProfile({ token, user: null, error: [401, 403].includes(error.response?.status) ? "auth" : "load" });
    });
    return () => { active = false; };
  }, [token, retry]);

  const user = token && profile.token === token ? profile.user : null;
  const userId = user?._id || user?.id || user?.email;
  const error = token && profile.token === token ? profile.error : "";

  const authPage = pathname === "/login" || pathname === "/register";
  const isBookingPage = pathname === "/booking" || pathname.startsWith("/booking/");

  useEffect(() => {
    if (!isBookingPage) return;
    if (error === "auth" && getAccessToken() === token) clearAccessToken();
    // Read storage here: the server snapshot is signed out until hydration finishes.
    // Do not redirect a commuter whose saved session is still being restored.
    if (!getAccessToken()) {
      const requested = window.location.pathname + window.location.search + window.location.hash;
      router.replace("/login?redirect=" + encodeURIComponent(requested));
    }
  }, [isBookingPage, pathname, token, error, router]);

  const persistSeenAlerts = useCallback((alerts) => {
    if (markAlertsSeen(userId, alerts)) setSeenVersion((version) => version + 1);
  }, [userId]);

  const loadNotifications = useCallback(async () => {
    if (!token || notificationRequestRef.current === token) return;
    notificationRequestRef.current = token;
    setNotifications((current) => ({ ...current, status: "loading" }));
    try {
      const items = await alertService.listActive();
      if (getAccessToken() !== token) return;
      if (notificationsOpenRef.current) persistSeenAlerts(items);
      setNotifications({ status: "ready", items });
    } catch {
      if (getAccessToken() === token) setNotifications({ status: "error", items: [] });
    } finally {
      if (notificationRequestRef.current === token) notificationRequestRef.current = false;
    }
  }, [persistSeenAlerts, token]);




  useEffect(() => {
    if (!user) return;
    if (authPage) {
      const requested = new URLSearchParams(window.location.search).get("redirect");
      const safe = requested?.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/login") && !requested.startsWith("/register") ? requested : "/";
      router.replace(getRoleHome(user.role, safe));
    } else if (pathname === "/" && user.role !== "commuter") router.replace(getRoleHome(user.role));
  }, [user, authPage, pathname, router]);

  useEffect(() => {
    const updateHash = () => setActiveHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen && !notificationsOpen) return;
    const close = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
      if (!notificationsRef.current?.contains(event.target)) {
        notificationsOpenRef.current = false;
        setNotificationsOpen(false);
      }
    };
    const escape = (event) => { if (event.key === "Escape") { setAccountOpen(false); notificationsOpenRef.current = false; setNotificationsOpen(false); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [accountOpen, notificationsOpen]);

  useEffect(() => {
    if (!driverMoreOpen) return undefined;
    const closeDriverMore = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (driverMoreRef.current?.contains(event.target) || driverMoreTriggerRef.current?.contains(event.target))) return;
      setDriverMoreOpen(false);
      if (event.type === "keydown") driverMoreTriggerRef.current?.focus();
    };
    document.addEventListener("keydown", closeDriverMore);
    document.addEventListener("pointerdown", closeDriverMore);
    return () => {
      document.removeEventListener("keydown", closeDriverMore);
      document.removeEventListener("pointerdown", closeDriverMore);
    };
  }, [driverMoreOpen]);


  // Never mount booking forms or their data effects before authentication succeeds.
  if (isBookingPage && (!token || error === "auth")) return <div className="app-auth-state"><p role="status">Please sign in to book a ticket.</p></div>;
  if (!token || pathname.startsWith("/safety/track/")) return children;
  if (error === "load") return <div className="app-auth-state"><p>Unable to verify your account. Check your connection and try again.</p><button type="button" onClick={() => setRetry(n => n + 1)}>Try again</button></div>;
  if (error === "auth") return <div className="app-auth-state"><p>Your session has expired.</p><Link href="/login">Sign in</Link></div>;
  if (!user) return <PendingAccountShell />;
  if (!allowed(pathname, user.role)) return <div className="app-auth-state"><p>You don&apos;t have permission to access this page.</p><Link href={getRoleHome(user.role)}>Go to your dashboard</Link></div>;
  if (authPage || (pathname === "/" && user.role !== "commuter")) return <PendingAccountShell />;

  const role = user.role;
  const items = role === "admin" ? admin : role === "driver" ? driver : commuter;
  const mobileItems = role === "admin" ? [admin[0], admin[1], admin[2], admin[3], admin[4]] : role === "driver" ? [driver[0], driver[1], driver[3], driver[4], { action: "more", label: "More", icon: MoreHorizontal }] : items;
  const title = role === "admin" ? "Admin Panel" : role === "driver" ? "Driver Dashboard" : "Smart Safar";
  const initials = user.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SS";
  const seenAlertIds = readSeenAlertIds(userId, seenVersion);
  const unreadAlerts = notifications.status === "ready"
    ? notifications.items.filter((alert) => {
      const id = alertIdentity(alert);
      return id && !seenAlertIds.has(id);
    })
    : [];
  const hasUnseenAlerts = unreadAlerts.length > 0;
  function logout() { clearPrivateSnapshots(getAccessToken()); clearAccessToken(); setConfirmLogout(false); setAccountOpen(false); router.replace("/"); }
  function closeNotifications() {
    notificationsOpenRef.current = false;
    setNotificationsOpen(false);
  }
  function toggleNotifications() {
    const next = !notificationsOpen;
    notificationsOpenRef.current = next;
    setNotificationsOpen(next);
    setAccountOpen(false);
    if (next && notifications.status === "ready") persistSeenAlerts(notifications.items);
    if (next && (notifications.status === "idle" || notifications.status === "error")) loadNotifications();
  }
  function navigate(event, href) {
    const [path, hash] = href.split("#");
    if (!hash || path !== pathname) return;
    event.preventDefault();
    const target = document.getElementById(hash);
    if (target) {
      window.history.pushState(null, "", href);
      setActiveHash(`#${hash}`);
      target.scrollIntoView({ behavior: motionSafeScrollBehavior(), block: "start" });
    }
  }

  return <div className={"app-experience app-experience--" + role}>
    <header className="app-header">
      <div className="app-header-inner">
        <Link href={getRoleHome(role)} className="app-brand">
          <BrandMark size={34} />
          <span><strong>{title}</strong><small>{role === "commuter" ? "Faisalabad transit" : "Smart Safar"}</small></span>
        </Link>
        <div className="app-header-actions">
          <span className="app-role-label">{role === "admin" ? "Administrator" : role === "driver" ? "Driver mode" : "Commuter"}</span>
          <PwaInstallAction className="app-install-action" />
          <div className="app-notifications" ref={notificationsRef}>
            <button type="button" className="app-icon-button" aria-label={hasUnseenAlerts ? "Open notifications, new alerts available" : "Open notifications"} aria-expanded={notificationsOpen} onClick={toggleNotifications}>
              <Bell size={19} />
              {hasUnseenAlerts && !notificationsOpen && <span className="app-notification-dot" aria-hidden="true" />}
            </button>
            {notificationsOpen && <section className="app-notification-panel" role="dialog" aria-label="Notifications">
              <header>
                <div><p>Notifications</p><span>Current route alerts</span></div>
                <button type="button" onClick={closeNotifications} aria-label="Close notifications"><X size={17} /></button>
              </header>
              <div className="app-notification-list">
                {notifications.status === "loading" ? <LoadingSpinner className="app-notification-state" /> : notifications.status === "error" ? <div className="app-notification-state"><p>Alerts are unavailable right now.</p><button type="button" onClick={loadNotifications}>Try again</button></div> : notifications.items.length ? notifications.items.map((alert) => <article key={alertIdentity(alert) || alert._id || alert.id} className={(() => { const id = alertIdentity(alert); return id && !seenAlertIds.has(id) ? "is-unseen" : ""; })()}><span className="app-notification-icon"><Bell size={15} /></span><div><strong>{alert.routeName || "Route alert"}</strong><p>{alert.message}</p>{(alert.createdAt || alert.expiresAt) && <time>{alert.createdAt ? new Date(alert.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : `Active until ${new Date(alert.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}</time>}</div></article>) : <p className="app-notification-state">No active alerts</p>}
              </div>
              {role === "admin" && <Link href="/admin/alerts" onClick={closeNotifications} className="app-notification-manage">Manage route alerts</Link>}
            </section>}
          </div>
          <div className="app-account" ref={accountRef}>
            <button type="button" className="app-avatar" aria-label="Open profile menu" aria-expanded={accountOpen} onClick={() => { setAccountOpen((open) => !open); closeNotifications(); }}>{initials}</button>
            {accountOpen && <div className="app-account-menu" role="menu"><div className="app-account-summary"><strong>{user.name}</strong><span>{user.email}</span></div><Link href="/profile" role="menuitem" onClick={() => setAccountOpen(false)}><UserRound size={17} /> Profile</Link><Link href="/settings" role="menuitem" onClick={() => setAccountOpen(false)}><Settings size={17} /> Settings</Link><button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setConfirmLogout(true); }}><LogOut size={17} /> Log out</button></div>}
          </div>
        </div>
      </div>
    </header>
    <div className="app-frame"><aside className="app-sidebar"><Navigation items={items} pathname={pathname} activeHash={activeHash} onNavigate={navigate} /></aside><div className="app-content"><ProfileContext.Provider value={{ token, user }}>{children}</ProfileContext.Provider></div></div>
    <Navigation items={mobileItems} pathname={pathname} activeHash={activeHash} onNavigate={(event, href) => { setDriverMoreOpen(false); navigate(event, href); }} onMore={(event) => { driverMoreTriggerRef.current = event.currentTarget; setDriverMoreOpen((open) => !open); }} moreOpen={driverMoreOpen} mobile />
    {role === "driver" && driverMoreOpen && <section ref={driverMoreRef} className="app-driver-more-menu" aria-label="More driver tools"><Link href="/driver/route" onClick={() => setDriverMoreOpen(false)}><MapPinned size={18} /> Route</Link><Link href="/reports" onClick={() => setDriverMoreOpen(false)}><ChartNoAxesCombined size={18} /> Reports</Link><Link href="/profile" onClick={() => setDriverMoreOpen(false)}><UserRound size={18} /> Profile</Link><button type="button" onClick={() => { setDriverMoreOpen(false); setConfirmLogout(true); }}><LogOut size={18} /> Sign out</button></section>}
    {confirmLogout && <div className="app-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmLogout(false); }}><section className="app-logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title"><button type="button" className="app-dialog-close" aria-label="Close" onClick={() => setConfirmLogout(false)}><X size={18} /></button><span className="app-dialog-icon"><LogOut size={22} /></span><h2 id="logout-title">Log out?</h2><p>Are you sure you want to log out?</p><div><button type="button" onClick={() => setConfirmLogout(false)}>Cancel</button><button type="button" className="is-danger" onClick={logout}>Log out</button></div></section></div>}
  </div>;
}

function PendingAccountShell() {
  return <div className="app-experience"><header className="app-header"><div className="app-header-inner"><Link href="/" className="app-brand"><BrandMark size={34} /><strong>Smart Safar</strong></Link><nav aria-label="Transit navigation" className="flex gap-4"><Link href="/routes">Routes</Link><Link href="/live-map">Live Map</Link></nav></div></header><PageSkeleton title="Preparing your workspace" variant="stats" /></div>;
}
