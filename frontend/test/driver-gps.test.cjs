const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
async function load(file, deps = {}, globals = {}) {
  const context = vm.createContext({ Date, Number, AbortController, queueMicrotask, ...globals });
  const mod = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src", file), "utf8"), { context });
  await mod.link(name => { const values = deps[name]; return new vm.SyntheticModule(Object.keys(values), function() { for(const key of Object.keys(values)) this.setExport(key, values[key]); }, { context }); });
  await mod.evaluate(); return mod.namespace;
}
async function setup({ enabled = true, upload = async () => ({ _id: "bus", lastLocationUpdate: new Date().toISOString() }) } = {}) {
  const model = await load("lib/transit/driverGps.js");
  let effect, success, failure, cleanup, watches = 0, clears = 0, retries = 0, signal;
  const calls = [], states = [], updates = [], events = {};
  const window = { isSecureContext: true, addEventListener: (name, fn) => events[name] = fn, removeEventListener: name => delete events[name] };
  const navigator = { onLine: true, geolocation: { watchPosition: (ok, fail) => { watches++; success = ok; failure = fail; return 7; }, clearWatch: () => clears++ } };
  const document = { visibilityState: "visible", addEventListener: (name, fn) => events[name] = fn, removeEventListener: name => delete events[name] };
  let stateIndex = 0;
  const react = { useState: initial => { const index = stateIndex++; return [typeof initial === "function" ? initial() : initial, () => { if (index === 0) retries++; }]; }, useEffect: fn => effect = fn };
  const hook = await load("hooks/useDriverLocation.js", { react, "../lib/transit/driverGps": model, "../services/busService": { busService: { updateLocation: async (...args) => { calls.push(args); signal = args[2].signal; return upload(); } } } }, { window, navigator, document });
  hook.useDriverLocation({ bus: { _id: "bus" }, enabled, onUpdate: value => updates.push(value), onStatusChange: state => states.push(state) });
  cleanup = effect(); await Promise.resolve();
  return { calls, states, updates, events, navigator, success: value => success(value), failure: value => failure(value), cleanup: () => cleanup?.(), watches: () => watches, clears: () => clears, retries: () => retries, signal: () => signal };
}
const fix = () => ({ timestamp: Date.now(), coords: { latitude: 31.4, longitude: 73.1, accuracy: 12, speed: 5 } });
test("one watcher, confirmed uploads, units, and cleanup", async () => {
  const rig = await setup(); assert.equal(rig.watches(), 1);
  await rig.success(fix()); assert.equal(rig.calls.length, 1); assert.equal(rig.calls[0][1].speed, 18);
  assert.equal(rig.states.at(-1), "sharing"); assert.equal(rig.updates.length, 1);
  rig.cleanup(); assert.equal(rig.clears(), 1); assert.equal(rig.signal().aborted, true); assert.equal(Object.keys(rig.events).length, 0);
});
test("off-duty never starts a watcher; stale or inaccurate fixes never upload", async () => {
  const off = await setup({ enabled: false }); assert.equal(off.watches(), 0);
  const rig = await setup();
  await rig.success({ ...fix(), timestamp: Date.now() - 60000 });
  await rig.success({ ...fix(), coords: { ...fix().coords, accuracy: 500 } });
  assert.equal(rig.calls.length, 0); assert.equal(rig.states.at(-1), "weak"); rig.cleanup();
});
test("denied permission does not auto-reprompt on reconnect or resume", async () => {
  const rig = await setup(); rig.failure({ code: 1 });
  rig.events.online(); rig.events.visibilitychange();
  assert.equal(rig.states.at(-1), "permission-denied"); assert.equal(rig.retries(), 0); rig.cleanup();
});
test("network recovery is event-driven; lost authorization stops uploads", async () => {
  const rig = await setup(); rig.navigator.onLine = false; rig.events.offline(); assert.equal(rig.states.at(-1), "error"); await rig.success(fix());
  assert.equal(rig.calls.length, 0); rig.navigator.onLine = true; rig.events.online(); assert.equal(rig.retries(), 1); rig.cleanup();
  const denied = await setup({ upload: async () => { throw { response: { status: 403 } }; } });
  await denied.success(fix()); await denied.success(fix());
  assert.equal(denied.calls.length, 1); assert.equal(denied.states.at(-1), "access-ended"); denied.cleanup();
});
test("a request in flight or a callback after cleanup cannot publish extra updates", async () => {
  let resolve;
  const rig = await setup({ upload: () => new Promise(done => resolve = done) });
  const pending = rig.success(fix()); await rig.success(fix()); assert.equal(rig.calls.length, 1);
  rig.cleanup(); resolve({ _id: "bus" }); await pending; assert.equal(rig.updates.length, 0);
});
test("older telemetry cannot replace newer telemetry; route order respects return direction", async () => {
  const model = await load("lib/transit/driverGps.js");
  assert.equal(model.isOlderLocation("2026-10-19T10:00:00Z", "2026-10-19T11:00:00Z"), true);
  const direction = await load("lib/transit/direction.js"), stops = [{ _id: "1" }, { _id: "2" }];
  assert.equal(direction.getStopsInDirection(stops, "outbound")[0]._id, "1");
  assert.equal(direction.getStopsInDirection(stops, "return")[0]._id, "2");
  assert.equal(stops[0]._id, "1");
  assert.equal(direction.getStopsInDirection([stops[0]], "return").length, 1);
});
