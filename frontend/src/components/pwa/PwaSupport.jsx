"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Wifi, WifiOff, X } from "lucide-react";
import { useDataSaver } from "../../hooks/useDataSaver";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../lib/auth/token";
import { getBookingQueueSummary, syncPendingBookings } from "../../lib/offline/bookingQueue";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function subscribeDisplayMode(callback) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", callback);
  return () => displayMode.removeEventListener("change", callback);
}

function serverStandalone() { return false; }

function isIOSSafari() {
  const userAgent = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  return isIOS && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

function publishInstallAvailability(available) {
  window.__smartSafarInstallAvailable = available;
  window.dispatchEvent(new CustomEvent("smart-safar:install-availability", { detail: { available } }));
}

function isOfflinePublicPath(pathname) {
  return pathname === "/"
    || pathname === "/live-map"
    || pathname === "/routes"
    || /^\/routes\/[^/]+$/.test(pathname)
    || /^\/buses\/[^/]+$/.test(pathname)
    || pathname === "/login"
    || pathname === "/register";
}

export function PwaSupport() {
  const { enabled: dataSaver } = useDataSaver();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [online, setOnline] = useState(true);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [bookingSync, setBookingSync] = useState({ pending: 0, attention: 0, syncing: false });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(true);
  const [installing, setInstalling] = useState(false);
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, serverStandalone);
  const [appInstalled, setInstalled] = useState(false);
  const installed = standalone || appInstalled;
  const [showIosHint, setShowIosHint] = useState(false);
  const [launchFinished, setLaunchFinished] = useState(false);
  const showLaunch = standalone && !launchFinished;
  const installPromptDismissedRef = useRef(false);
  const iosHintDismissedRef = useRef(false);
  const connectivityRef = useRef(null);
  const reconnectDelayRef = useRef(null);
  const reconnectDismissRef = useRef(null);
  const lastReconnectNoticeRef = useRef(0);
  const serviceWorkerRegistrationRef = useRef(false);
  const isPublicHome = pathname === "/" && !isAuthenticated;

  const promptToInstall = useCallback(async () => {
    if (installed) return;
    if (!installPrompt) {
      if (isIOSSafari() && !installed) setShowIosHint(true);
      return;
    }

    setInstalling(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      // Dismissing the browser prompt is not an application error.
    } finally {
      setInstallPrompt(null);
      setInstalling(false);
      publishInstallAvailability(false);
    }
  }, [installPrompt, installed]);

  useEffect(() => {
    if (!showLaunch) return undefined;
    const finish = () => setLaunchFinished(true);
    // This root-mounted sequence runs once per PWA launch, never on route
    // changes. Reduced-motion users receive the static brand reveal instead.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const completionTimer = window.setTimeout(finish, reducedMotion ? 320 : 1400);
    return () => {
      window.clearTimeout(completionTimer);
    };
  }, [showLaunch]);

  useEffect(() => {
    const clearReconnectTimers = () => {
      window.clearTimeout(reconnectDelayRef.current);
      window.clearTimeout(reconnectDismissRef.current);
      reconnectDelayRef.current = null;
      reconnectDismissRef.current = null;
    };
    const syncConnectivity = () => {
      const nextOnline = window.navigator.onLine;
      const previousOnline = connectivityRef.current;
      connectivityRef.current = nextOnline;
      setOnline(nextOnline);

      if (!nextOnline) {
        clearReconnectTimers();
        setShowBackOnline(false);
        return;
      }

      // A short stable-online delay avoids flashing status messages while a
      // mobile connection is bouncing between networks.
      if (previousOnline === false && Date.now() - lastReconnectNoticeRef.current > 5000) {
        clearReconnectTimers();
        reconnectDelayRef.current = window.setTimeout(() => {
          if (!window.navigator.onLine) return;
          lastReconnectNoticeRef.current = Date.now();
          setShowBackOnline(true);
          reconnectDismissRef.current = window.setTimeout(() => setShowBackOnline(false), 4200);
        }, 500);
      }
    };
    const receiveInstallPrompt = (event) => {
      event.preventDefault();
      if (isStandalone()) { publishInstallAvailability(false); return; }
      setInstallPrompt(event);
      if (!installPromptDismissedRef.current) setShowInstallPrompt(true);
      publishInstallAvailability(true);
    };
    const markInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowInstallPrompt(false);
      setShowIosHint(false);
      publishInstallAvailability(false);
    };
    const openInstall = () => promptToInstall();

    syncConnectivity();
    publishInstallAvailability(!installed && (Boolean(installPrompt) || (isIOSSafari() && !isStandalone())));
    window.addEventListener("online", syncConnectivity);
    window.addEventListener("offline", syncConnectivity);
    window.addEventListener("beforeinstallprompt", receiveInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    window.addEventListener("smart-safar:open-install", openInstall);

    let hintTimer;
    if (isIOSSafari() && !isStandalone() && !iosHintDismissedRef.current) hintTimer = window.setTimeout(() => setShowIosHint(true), 0);

    return () => {
      window.removeEventListener("online", syncConnectivity);
      window.removeEventListener("offline", syncConnectivity);
      window.removeEventListener("beforeinstallprompt", receiveInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
      window.removeEventListener("smart-safar:open-install", openInstall);
      if (hintTimer) window.clearTimeout(hintTimer);
      clearReconnectTimers();
    };
  }, [promptToInstall, installPrompt, installed]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    const refresh = async () => {
      const summary = await getBookingQueueSummary(getAccessToken());
      if (active) setBookingSync((current) => ({ ...current, ...summary }));
    };
    const process = async () => {
      if (!navigator.onLine) { refresh(); return; }
      if (active) setBookingSync((current) => ({ ...current, syncing: true }));
      await syncPendingBookings(getAccessToken());
      if (active) setBookingSync((current) => ({ ...current, syncing: false }));
      refresh();
    };
    const onQueueChange = () => refresh();
    const onVisible = () => { if (document.visibilityState === "visible") process(); };
    process();
    window.addEventListener("online", process);
    window.addEventListener("smart-safar:booking-queue", onQueueChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; window.removeEventListener("online", process); window.removeEventListener("smart-safar:booking-queue", onQueueChange); document.removeEventListener("visibilitychange", onVisible); };
  }, [isAuthenticated]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || serviceWorkerRegistrationRef.current) return undefined;
    serviceWorkerRegistrationRef.current = true;
    const register = () => navigator.serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // A failed registration must never affect transit data or the app shell.
    });
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    if (dataSaver || process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !navigator.onLine) return undefined;
    let cancelled = false;
    let idleHandle;
    const schedule = window.requestIdleCallback
      ? (callback) => window.requestIdleCallback(callback, { timeout: 4000 })
      : (callback) => window.setTimeout(callback, 1200);
    const cancel = window.cancelIdleCallback
      ? (handle) => window.cancelIdleCallback(handle)
      : (handle) => window.clearTimeout(handle);
    navigator.serviceWorker.ready.then(() => {
      if (cancelled) return;
      idleHandle = schedule(() => {
        if (cancelled) return;
        const appDocuments = ["/", "/routes", "/live-map"];
        const loadedAssets = performance.getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(window.location.origin + "/_next/static/"))
          .slice(0, 40);
        // Warm the offline shell only after the current page is interactive so
        // its network work never competes with a cold app launch.
        Promise.all([...appDocuments, ...loadedAssets].map((resource) => fetch(resource, { headers: resource.startsWith("/") ? { Accept: "text/html" } : undefined }).catch(() => null)));
      });
    });
    return () => { cancelled = true; if (idleHandle != null) cancel(idleHandle); };
  }, [dataSaver]);

  useEffect(() => {
    if (!window.navigator.onLine || !isOfflinePublicPath(pathname)) return;
    fetch(pathname, { headers: { Accept: "text/html" } }).catch(() => {
      // The route remains usable online even when warming its offline document fails.
    });
  }, [pathname]);

  useEffect(() => {
    const useCachedDocument = (event) => {
      if (window.navigator.onLine || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || !isOfflinePublicPath(target.pathname)) return;
      event.preventDefault();
      window.location.assign(target.pathname + target.search + target.hash);
    };
    document.addEventListener("click", useCachedDocument, true);
    return () => document.removeEventListener("click", useCachedDocument, true);
  }, []);

  function dismissInstallPrompt() {
    installPromptDismissedRef.current = true;
    setShowInstallPrompt(false);
  }

  function dismissIosHint() {
    iosHintDismissedRef.current = true;
    setShowIosHint(false);
  }

  function skipLaunch() {
    setLaunchFinished(true);
  }

  return <>
    {showLaunch && <section className="pwa-launch" role="dialog" aria-label="Opening Smart Safar"><button type="button" className="pwa-launch__skip" onClick={skipLaunch}>Skip animation</button><div className="pwa-launch__scene"><div className="pwa-launch__cinema" aria-hidden="true"><span className="pwa-launch__horizon" /><span className="pwa-launch__road"><i /><i /><i /></span><Image className="pwa-launch__bus" src="/smart-safar-launch-bus.svg" width={420} height={180} alt="" priority /><span className="pwa-launch__glow" /><span className="pwa-launch__trail"><i /><i /><i /></span><svg className="pwa-launch__route" viewBox="0 0 340 96" fill="none" focusable="false"><path d="M12 72C64 72 72 22 128 22c59 0 48 52 106 52 40 0 56-26 94-43" pathLength="1" /><path d="M16 83c44 0 53-40 107-40 50 0 53 35 104 35 42 0 62-29 97-36" pathLength="1" /></svg></div><div className="pwa-launch__brand"><Image src="/smart-transit-logo.svg" width={56} height={56} alt="" priority /><strong>Smart Safar</strong><p>Smart Public Transit for Faisalabad</p></div></div></section>}
    {!online && <aside className="pwa-connectivity pwa-offline" role="status" aria-live="polite"><WifiOff size={18} aria-hidden="true" /><span><strong>Offline</strong><small>Showing saved transit information where it is available.</small></span></aside>}
    {showBackOnline && online && <aside className="pwa-connectivity pwa-online" role="status" aria-live="polite"><Wifi size={18} aria-hidden="true" /><span><strong>Back online</strong><small>Live transit updates are reconnecting.</small></span></aside>}
    {(bookingSync.syncing || bookingSync.pending || bookingSync.attention) && <aside className="pwa-connectivity pwa-sync-status" role="status" aria-live="polite"><Wifi size={18} aria-hidden="true" /><span><strong>{bookingSync.attention ? `${bookingSync.attention} booking request${bookingSync.attention === 1 ? "" : "s"} need attention` : bookingSync.syncing ? "Synchronizing booking requests" : `Offline: ${bookingSync.pending} booking request${bookingSync.pending === 1 ? "" : "s"} pending`}</strong><small>{bookingSync.attention ? "Review the request when you are ready." : "A seat is not reserved until Smart Safar confirms it."}</small></span></aside>}
    {isPublicHome && !installed && installPrompt && showInstallPrompt && <aside className="pwa-install" role="status" aria-live="polite"><div><strong>Install Smart Safar</strong><span>Add Smart Safar to your home screen for a faster app-like experience.</span></div><button type="button" onClick={promptToInstall} disabled={installing}>{installing ? "Opening..." : "Install"}</button><button type="button" className="pwa-install-close" onClick={dismissInstallPrompt} aria-label="Dismiss install prompt"><X size={17} /></button></aside>}
    {isPublicHome && showIosHint && !installed && <aside className="pwa-ios-install" role="status" aria-label="Install Smart Safar"><div><strong>Install Smart Safar</strong><span>To install: Share, then Add to Home Screen</span></div><button type="button" className="pwa-ios-install-close" onClick={dismissIosHint} aria-label="Dismiss install instructions"><X size={17} /></button></aside>}
  </>;
}
