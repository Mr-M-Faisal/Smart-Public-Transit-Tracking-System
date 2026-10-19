const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
async function launch({ saved, type = "navigate", reduced = false } = {}) {
  let timer, delay;
  const storage = new Map(saved ? [["smart-safar-internal-handoff", JSON.stringify(saved)]] : []);
  const context = vm.createContext({
    window: { location: { origin: "https://safar.test", href: "https://safar.test/routes", pathname: "/routes", search: "" }, matchMedia: () => ({ matches: reduced }), setTimeout: (callback, ms) => { timer = callback; delay = ms; } },
    navigator: { onLine: false }, performance: { getEntriesByType: () => [{ type }] },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, Date, URL,
  });
  const loadedModule = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src/lib/pwa/launch.js"), "utf8"), { context });
  await loadedModule.link(() => {}); await loadedModule.evaluate();
  return { api: loadedModule.namespace, context, storage, finish: () => timer(), delay: () => delay };
}
test("launch is document-scoped across Strict Mode subscriptions, remounts and network changes", async () => {
  const { api, context, finish } = await launch();
  const unsubscribe = api.subscribeLaunch(() => {});
  assert.equal(api.launchSnapshot(), true);
  unsubscribe();
  api.subscribeLaunch(() => {});
  finish();
  assert.equal(api.launchSnapshot(), false);
  context.navigator.onLine = true;
  api.subscribeLaunch(() => {});
  assert.equal(api.launchSnapshot(), false);
  const fresh = await launch(); fresh.api.subscribeLaunch(() => {});
  assert.equal(fresh.api.launchSnapshot(), true);
});
test("one-use offline handoff suppresses fallback only; reload, stale marker and different route launch normally", async () => {
  for (const [options, visible] of [
    [{ saved: { path: "/routes", at: Date.now() } }, false],
    [{ type: "reload", saved: { path: "/routes", at: Date.now() } }, true],
    [{ saved: { path: "/routes", at: Date.now() - 20000 } }, true],
    [{ saved: { path: "/booking", at: Date.now() } }, true],
  ]) {
    const { api, storage } = await launch(options); api.subscribeLaunch(() => {});
    assert.equal(api.launchSnapshot(), visible);
    assert.equal(storage.size, 0);
  }
});
test("reduced motion has a brief static state and skip finishes immediately", async () => {
  const { api, delay } = await launch({ reduced: true }); api.subscribeLaunch(() => {});
  assert.equal(delay(), 160); api.finishLaunch(); assert.equal(api.launchSnapshot(), false);
});
test("Flight keys ignore volatile request hashes but isolate router trees and HTML", () => {
  const context = vm.createContext({ URL, Request, Response, self: { addEventListener() {}, location: { origin: "https://safar.test" } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/service-worker.js"), "utf8"), context);
  const key = (hash, tree) => context.normalizedCacheRequest(new Request("https://safar.test/routes?_rsc=" + hash, { headers: { RSC: "1", "Next-Router-State-Tree": tree } })).url;
  assert.equal(key("a", "home"), key("b", "home"));
  assert.notEqual(key("a", "home"), key("a", "booking"));
  assert.notEqual(key("a", "home"), context.normalizedCacheRequest(new Request("https://safar.test/routes")).url);
});
