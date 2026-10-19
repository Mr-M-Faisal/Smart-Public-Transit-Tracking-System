// Lifetime belongs to this document, never to a route or React component.
const key = "__smartSafarLaunch";
const handoffKey = "smart-safar-internal-handoff";
export function markOfflineNavigation(href) {
  if (navigator.onLine) return;
  try {
    const target = new URL(href, window.location.href);
    if (target.pathname + target.search === window.location.pathname + window.location.search) return;
    if (target.origin === window.location.origin)
      sessionStorage.setItem(handoffKey, JSON.stringify({ path: target.pathname + target.search, at: Date.now() }));
  } catch { /* Storage is optional. Next navigation still works. */ }
}
function consumeHandoff() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(handoffKey));
    sessionStorage.removeItem(handoffKey);
    return saved && performance.getEntriesByType("navigation")[0]?.type === "navigate"
      && saved.path === window.location.pathname + window.location.search
      && Date.now() - saved.at >= 0 && Date.now() - saved.at < 10000;
  } catch { return false; }
}
export function subscribeLaunch(listener) {
  if (!window[key]) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = window[key] = { visible: !consumeHandoff(), listeners: new Set() };
    // Never wait for authentication, GPS or network readiness.
    if (state.visible) window.setTimeout(finishLaunch, reduced ? 160 : 1400);
  }
  window[key].listeners.add(listener);
  listener();
  return () => window[key].listeners.delete(listener);
}
export function launchSnapshot() { return window[key]?.visible || false; }
export function serverLaunchSnapshot() { return false; }
export function finishLaunch() {
  if (!window[key]) return;
  window[key].visible = false;
  window[key].listeners.forEach(listener => listener());
}

export function clearNavigationHandoff() {
  try { sessionStorage.removeItem(handoffKey); } catch { /* Optional storage. */ }
}
