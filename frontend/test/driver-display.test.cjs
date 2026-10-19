const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
async function display() {
  const loaded = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src/lib/transit/driverDisplay.js"), "utf8"));
  await loaded.link(() => {}); await loaded.evaluate(); return loaded.namespace.driverDisplay;
}
const now = Date.parse("2026-10-19T12:00:00Z");
const sample = { now, shiftActive: true, bus: { lastLocationUpdate: new Date(now - 10000).toISOString() }, eta: { currentStop: { stopName: "Reported stop" }, nextStop: { stopName: "Next reported stop" }, etaMinutes: 5.4 }, gpsStatus: { state: "sharing" } };
test("fresh API values display without inventing stops", async () => {
  const format = await display(), result = format(sample);
  assert.equal(result.gps, "GPS On"); assert.equal(result.arrival, "5 min");
  assert.equal(result.currentLocation, "Reported stop"); assert.equal(result.nextStop, "Next reported stop");
  assert.equal(format({ ...sample, eta: {} }).currentLocation, "Location unavailable");
  assert.equal(format({ ...sample, eta: {} }).nextStop, "Not available");
  assert.equal(format({ ...sample, eta: {} }).arrival, "Not available");
});
test("inactive shifts never show live GPS or an arrival", async () => {
  const format = await display(), result = format({ ...sample, shiftActive: false });
  assert.equal(result.gps, "GPS Off"); assert.equal(result.arrival, "Not available"); assert.equal(result.currentLocation, "Location unavailable");
});
test("GPS starting, weak and permission denied are distinct from GPS On", async () => {
  const format = await display();
  assert.equal(format({ ...sample, bus: {}, gpsStatus: { state: "starting" } }).gps, "GPS Starting");
  for (const state of ["error", "weak", "permission-denied"]) {
    const result = format({ ...sample, gpsStatus: { state } });
    assert.equal(result.gps, state === "permission-denied" ? "GPS Off" : "GPS Weak");
    assert.equal(result.currentLocation, "Location unavailable"); assert.equal(result.arrival, "Calculating...");
  }
});
test("stale, missing and future location timestamps cannot imply live data", async () => {
  const format = await display();
  for (const timestamp of [undefined, "invalid", new Date(now - 120001).toISOString(), new Date(now + 60000).toISOString()]) {
    const result = format({ ...sample, bus: { lastLocationUpdate: timestamp } });
    assert.notEqual(result.gps, "GPS On"); assert.equal(result.arrival, "Calculating...");
  }
});
test("ETA display rejects unreasonable and invalid values without changing calculations", async () => {
  const format = await display();
  for (const etaMinutes of [903, 121, -1, Infinity, NaN, null, "5"]) {
    assert.equal(format({ ...sample, eta: { ...sample.eta, etaMinutes } }).arrival, "Calculating...");
  }
  assert.equal(format({ ...sample, eta: { ...sample.eta, etaMinutes: 0 } }).arrival, "Arriving");
  assert.equal(format({ ...sample, eta: { ...sample.eta, etaMinutes: 120 } }).arrival, "120 min");
  assert.equal(format({ ...sample, errors: { eta: true } }).arrival, "Not available");
});
