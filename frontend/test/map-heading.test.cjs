const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
async function helpers() {
  const loaded = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src/lib/transit/mapHeading.js"), "utf8"));
  await loaded.link(() => {}); await loaded.evaluate(); return loaded.namespace;
}
const now = 1792411200000;
const fix = (position, timestamp = now, extra = {}) => ({ position, timestamp, ...extra });
test("normalization and shortest turn cross north without a long rotation", async () => {
  const h = await helpers();
  assert.equal(h.normalizeHeading(-10), 350); assert.equal(h.normalizeHeading(370), 10);
  assert.equal(h.normalizeHeading(NaN), null); assert.equal(h.normalizeHeading(null), null);
  assert.equal(h.shortestTurn(350, 10), 20); assert.equal(h.shortestTurn(10, 350), -20);
  const start = h.nextMapHeading(null, fix([0,0],now-1000,{heading:350}), now);
  assert.equal(h.nextMapHeading(start,fix([0,0],now,{heading:10}),now).rotation,370);
});
test("fallback bearings match cardinal directions and a right turn", async () => {
  const h = await helpers();
  const start = h.nextMapHeading(null,fix([0,0],now-1000),now);
  for (const [position, bearing] of [[[0.001,0],0],[[0,0.001],90],[[-0.001,0],180],[[0,-0.001],270]]) {
    assert.ok(Math.abs(h.nextMapHeading(start,fix(position),now).heading-bearing)<0.001);
  }
  const north = h.nextMapHeading(start,fix([0.001,0],now-500),now);
  assert.ok(Math.abs(h.nextMapHeading(north,fix([0.001,0.001]),now).rotation-90)<0.001);
});
test("stationary noise retains heading; invalid and stale fixes cannot change it", async () => {
  const h = await helpers();
  const start = h.nextMapHeading(null,fix([31,73],now-1000,{heading:90}),now);
  assert.equal(h.nextMapHeading(start,fix([31.00001,73]),now).heading,90);
  assert.equal(h.nextMapHeading(start,fix([31.001,73],now,{speed:0,heading:180}),now).heading,90);
  for (const bad of [fix([91,0]),fix([31,73],now+1),fix([31,73],now-30001),fix([31,73],now,{stale:true}),fix([31,73],now,{accuracy:101})]) {
    assert.equal(h.nextMapHeading(start,bad,now),start);
  }
  assert.equal(h.nextMapHeading(start, {position:[31,73]},now),start);
  assert.equal(h.nextMapHeading(start,fix([32,74],now-2000),now),start);
});
test("unknown heading, gaps and inaccurate short movements do not invent direction", async () => {
  const h = await helpers();
  const start = h.nextMapHeading(null,fix([0,0],now-1000,{accuracy:80}),now);
  assert.equal(start.heading,undefined);
  assert.equal(h.nextMapHeading(start,fix([0.001,0],now,{accuracy:80}),now).heading,undefined);
  assert.equal(h.nextMapHeading({...start,timestamp:now-60000},fix([1,0]),now).heading,undefined);
});
test("follow stays with the explicitly selected bus and pauses for missing or stale GPS", async () => {
  const h = await helpers();
  const bus = {_id:"a",status:"active",position:[31,73],lastLocationUpdate:now};
  assert.equal(h.canFollowBus(null,bus,now),false);
  assert.equal(h.canFollowBus("a",bus,now),true);
  assert.equal(h.canFollowBus("a",{...bus,_id:"b"},now),false);
  assert.equal(h.canFollowBus(null,bus,now),false); // manual suspension
  assert.equal(h.canFollowBus("a",{...bus,isSaved:true},now),false);
  assert.equal(h.canFollowBus("a",{...bus,status:"idle"},now),false);
  assert.equal(h.canFollowBus("a",{...bus,lastLocationUpdate:null},now),false);
  assert.equal(h.canFollowBus("a",bus,now+30001),false);
  assert.equal(h.canFollowBus("a",{...bus,lastLocationUpdate:now+31000},now+31000),true);
});

test("manual map interaction suspends follow and removes listeners on unmount", async () => {
  const effects = [], mapEvents = new Map(), domEvents = new Map();
  let suspended = 0, stopped = 0;
  const container = { addEventListener: (event, fn) => domEvents.set(event,fn), removeEventListener: event => domEvents.delete(event) };
  const map = { on: (event,fn) => mapEvents.set(event,fn), off: event => mapEvents.delete(event), stop: () => stopped++, getContainer: () => container };
  const modules = {
    react: { useEffect: fn => effects.push(fn), useLayoutEffect: () => {}, useRef: current => ({current}) },
    "react-leaflet": { useMap: () => map },
    "../../lib/transit/coordinates": { isValidPosition: () => true },
    "../../lib/live-map/liveMapStorage": { readLiveMapState: () => Promise.resolve(null), saveLiveMapViewport: () => {} },
  };
  const loaded = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src/components/map/MapViewport.jsx"), "utf8"));
  await loaded.link(name => new vm.SyntheticModule(Object.keys(modules[name]),function() { for (const [key,value] of Object.entries(modules[name])) this.setExport(key,value); }));
  await loaded.evaluate();
  loaded.namespace.MapViewport({onFollowSuspend: () => suspended++});
  const cleanup = effects[0]();
  mapEvents.get("dragstart")();
  domEvents.get("wheel")();
  domEvents.get("keydown")({key:"ArrowLeft"});
  domEvents.get("keydown")({key:"Tab"});
  assert.equal(suspended,3); assert.equal(stopped,3);
  assert.equal(mapEvents.has("movestart"),false); // programmatic pans must not cancel follow
  cleanup();
  assert.equal(mapEvents.size,0); assert.equal(domEvents.size,0);
});
