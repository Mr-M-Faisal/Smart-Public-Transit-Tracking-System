// Optional Windows Chrome smoke check. Uses only an isolated test database.
// Requires a completed frontend production build and free frontend port 3007.
// Browser backend HTTP requests are redirected to this isolated ephemeral server.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
process.env.CORS_ORIGINS = 'http://localhost:3007';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const { server, io } = require('../src/server');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Route = require('../src/models/Route');
const Stop = require('../src/models/Stop');
const RouteStop = require('../src/models/RouteStop');
const Bus = require('../src/models/Bus');
const Shift = require('../src/models/Shift');
const database = 'transit_render_test_' + crypto.randomBytes(8).toString('hex');
const frontend = path.resolve(__dirname, '../../frontend');
let next, chrome, ws, profileDirectory;
const pending = new Map();
let sequence = 0, sessionId, holdAnalytics = true, offline = false;
let connections = 0, failMutation = false, mutationAttempts = 0;
let stage = 'initial';
io.on('connection', () => { connections++; });
const errors = [], requests = [], heldAnalytics = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function command(method, params = {}, session = sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error((result.exceptionDetails.exception?.description || result.exceptionDetails.text) + ' | expression: ' + expression);
  return result.result.value;
}
async function waitFor(expression, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await evaluate(expression)) return; } catch (error) { if (!/context|Cannot find/i.test(error.message)) throw error; } await pause(150); }
  throw new Error('Timed out: ' + label + ' | ' + await evaluate('document.body.innerText.slice(0, 600)'));
}
async function navigate(route) {
  stage = route;
  const previousOrigin = await evaluate('performance.timeOrigin');
  await command('Page.navigate', { url: 'http://localhost:3007' + route });
  await waitFor('performance.timeOrigin !== ' + previousOrigin + ' && location.pathname === ' + JSON.stringify(route) + ' && Boolean(document.querySelector("main, .app-content, .app-auth-state"))', route + ' shell');
}
async function clickRoute(route) {
  const expression = '(function(){const links=[...document.querySelectorAll("a")];const a=links.find(a=>a.getAttribute("href")===' + JSON.stringify(route) + ' && a.getClientRects().length);if(!a)return false;a.click();return true})()';
  assert.equal(await evaluate(expression), true, 'Visible navigation link ' + route);
  await waitFor('location.pathname === ' + JSON.stringify(route), route + ' navigation');
}
async function asUser(token, route) {
  await evaluate('localStorage.setItem("smart-transit-access-token", ' + JSON.stringify(token) + ')');
  await navigate(route);
}
(async () => {
  try {
    await mongoose.connect(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { dbName: database, serverSelectionTimeoutMS: 10000 });
    assert.equal(mongoose.connection.name, database);
    for (const model of [User, Route, Stop, RouteStop, Bus, Shift]) await model.init();
    const password = crypto.randomBytes(20).toString('hex');
    const users = {};
    for (const role of ['admin', 'driver', 'commuter']) users[role] = await User.create({ name: 'Browser ' + role, email: role + '@browser.integration', password, role });
    const route = await Route.create({ routeName: 'Browser verification route', startPoint: 'Start', endPoint: 'End', geometry: { outbound: [[31.42, 73.08], [31.43, 73.09]], return: [[31.43, 73.09], [31.42, 73.08]] }, geometryStatus: 'ready' });
    const stops = await Stop.create([{ stopName: 'First', latitude: 31.42, longitude: 73.08 }, { stopName: 'Last', latitude: 31.43, longitude: 73.09 }]);
    await RouteStop.create(stops.map((stop, i) => ({ route: route._id, stop: stop._id, stopOrder: i + 1 })));
    const bus = await Bus.create({ busNumber: 'BROWSER-CHECK', route: route._id, driver: users.driver._id, capacity: 2, availableSeats: 2, status: 'active', currentLocation: { latitude: 31.42, longitude: 73.08 }, seatMap: [{ label: 'A1', row: 0, column: 0, status: 'available' }, { label: 'A2', row: 0, column: 1, status: 'available' }] });
    await User.findByIdAndUpdate(users.driver._id, { assignedBus: bus._id });
    await Shift.create({ driver: users.driver._id, bus: bus._id, route: route._id, startDirection: 'outbound' });
    const tokens = Object.fromEntries(Object.entries(users).map(([role, user]) => [role, jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '10m' })]));
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, resolve); });
    next = spawn(process.execPath, [path.join(frontend, 'node_modules/next/dist/bin/next'), 'start', '-p', '3007'], { cwd: frontend, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let nextErrors = '';
    next.stderr.on('data', (chunk) => { nextErrors += chunk; });
    next.stdout.resume();
    let ready = false;
    for (let i = 0; i < 80; i++) { try { ready = (await fetch('http://localhost:3007')).ok; } catch {} if (ready) break; await pause(150); }
    assert.ok(ready, 'Next server failed: ' + nextErrors);
    profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-safar-phase3-'));
    const executable = process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    chrome = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profileDirectory, '--no-first-run', '--disable-default-apps', '--disable-background-networking', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Chrome startup timeout')), 15000);
      chrome.once('error', reject);
      chrome.stderr.on('data', (chunk) => { output += chunk; const marker = 'DevTools listening on '; const start = output.indexOf(marker); if (start >= 0 && output.indexOf(String.fromCharCode(10), start) >= 0) { clearTimeout(timeout); resolve(output.slice(start + marker.length).split(String.fromCharCode(10))[0].trim()); } });
    });
    ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) { const call = pending.get(message.id); if (call) { clearTimeout(call.timer); pending.delete(message.id); message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result); } }
      if (message.method === 'Fetch.requestPaused' && failMutation && message.params.request.method === 'POST' && new URL(message.params.request.url).pathname === '/api/routes') { mutationAttempts++; command('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'ConnectionFailed' }).catch(() => {}); return; }
      if (message.method === 'Fetch.requestPaused' && offline) { command('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'InternetDisconnected' }).catch(() => {}); return; }
      if (message.method === 'Fetch.requestPaused') { const params = { requestId: message.params.requestId, url: message.params.request.url.replace('http://localhost:5000', 'http://localhost:' + server.address().port) }; if (holdAnalytics && message.params.request.url.includes('/api/admin/dashboard?section=analytics')) heldAnalytics.push(params); else command('Fetch.continueRequest', params).catch(() => {}); }
      if (message.method === 'Runtime.exceptionThrown') console.log('Runtime error at', stage);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        const text = message.params.args.map((arg) => arg.value || arg.description || '').join(' ');
        if (/hydration|Minified React|window is not defined|Invalid hook|Cannot read/i.test(text)) errors.push(text);
      }
      if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/api/') && message.params.request.method === 'GET') requests.push(message.params.request.url);
    });
    const target = await command('Target.createTarget', { url: 'about:blank' }, null);
    sessionId = (await command('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
    await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
    await command('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:5000/*', requestStage: 'Request' }] });
    await command('Network.setBypassServiceWorker', { bypass: false });
    await command('Network.setBlockedURLs', { urls: ['ws://localhost:5000/*'] });
    await command('Page.addScriptToEvaluateOnNewDocument', { source: 'if (!localStorage.getItem("smart-safar-theme-v1")) localStorage.setItem("smart-safar-theme-v1", "blue");' });
    await navigate('/');
    await waitFor('[...document.querySelectorAll("a")].some(a => a.getAttribute("href") === "/routes")', 'home navigation');
    await clickRoute('/routes');
    await waitFor('Boolean(document.querySelector(' + JSON.stringify('a[href="/routes/' + route._id + '"]') + '))', 'route cards');
    await clickRoute('/routes/' + route._id);
    await waitFor('document.body.innerText.includes("Browser verification route") && Boolean(document.querySelector(".leaflet-container"))', 'route detail road map');
    await waitFor('Boolean(document.querySelector(".leaflet-overlay-pane path"))', 'road polyline');
    await clickRoute('/live-map');
    await waitFor('Boolean(document.querySelector(".leaflet-container")) && document.body.innerText.includes("BROWSER-CHECK")', 'live map');
    console.log('PASS Home -> Routes -> Route Details -> Live Map, including Leaflet road geometry');

    const connectionBaseline = connections;
    await clickRoute('/routes');
    const countBefore = requests.filter((url) => new URL(url).pathname === '/api/routes' && !url.includes('includeGeometry')).length;
    await clickRoute('/');
    const navStart = performance.now();
    await clickRoute('/routes');
    await waitFor('document.body.innerText.includes("Browser verification route") && !document.querySelector("main [aria-busy=true]")', 'cached routes render');
    const elapsed = Math.round(performance.now() - navStart);
    const countAfter = requests.filter((url) => new URL(url).pathname === '/api/routes' && !url.includes('includeGeometry')).length;
    assert.equal(countAfter, countBefore, 'Fresh route cache reused without GET');
    assert.equal(connections, connectionBaseline, 'No socket reconnect on client navigation');
    console.log('MEASURE Routes -> Home -> Routes: ' + elapsed + ' ms until test observed cards, ' + (countAfter - countBefore) + ' additional route GETs; same socket');
    await clickRoute('/routes/' + route._id);
    await waitFor('Boolean(document.querySelector(".leaflet-overlay-pane path"))', 'cached road geometry');
    await clickRoute('/live-map');
    await waitFor('Boolean(document.querySelector(".leaflet-overlay-pane path")) && document.body.innerText.includes("Stops visible")', 'cached live map geometry');
    await navigate('/buses/' + bus._id);
    await waitFor('document.body.innerText.includes("BROWSER-CHECK")', 'bus metadata saved');
    await evaluate('navigator.serviceWorker.ready.then(() => true)');
    await waitFor('Boolean(navigator.serviceWorker.controller)', 'worker controlling app');
    await pause(1000);
    const records = await evaluate('new Promise((resolve,reject)=>{const r=indexedDB.open("smart-safar-live-map",1);r.onsuccess=()=>{const q=r.result.transaction("snapshots").objectStore("snapshots").get("public-queries-v1");q.onsuccess=()=>resolve(q.result);q.onerror=reject}})');
    assert.ok(records.data.some((entry) => entry.queryKey[1] === 'geometry'));
    assert.ok(records.data.some((entry) => entry.queryKey[1] === 'stops'));
    assert.ok(!JSON.stringify(records).includes('seatMap'));
    assert.ok(!JSON.stringify(records).includes('currentLocation'));
    const apiCaches = await evaluate('caches.keys().then(async names => (await Promise.all(names.map(async n => (await (await caches.open(n)).keys()).map(r=>r.url)))).flat().filter(u=>u.includes("/api/")))');
    assert.deepEqual(apiCaches, [], 'No API/private data in service worker cache');
    offline = true;
    await command('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    for (const page of ['/routes', '/routes/' + route._id, '/live-map', '/', '/buses/' + bus._id]) {
      await navigate(page);
      await waitFor('document.body.innerText.includes(' + JSON.stringify(page.startsWith('/buses') ? 'BROWSER-CHECK' : page === '/live-map' ? 'Stops visible' : 'Browser verification route') + ')', 'offline cold load ' + page);
      await waitFor('document.body.innerText.includes("Offline")', 'Offline indication ' + page);
      if (page.startsWith('/routes/')) {
        await waitFor('Boolean(document.querySelector(".leaflet-overlay-pane path")) && document.body.innerText.includes("First")', 'offline stops and road geometry');
      }
    }
    console.log('PASS Offline document reload: Home, Routes, Route Details/stops/geometry, Live Map and safe bus metadata');
    offline = false;
    await command('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await waitFor('document.body.innerText.includes("Currently operating")', 'silent reconnect bus refresh');
    console.log('PASS Reconnect refreshes live bus data without manual reload');
    // Compare decorative image transfer with clean HTTP cache, identical viewport
    // and SW bypass. Public reference data is already warmed in both runs.
    await command('Network.setBypassServiceWorker', { bypass: true });
    await command('Network.setCacheDisabled', { cacheDisabled: true });
    const measurements = {};
    for (const mode of ['off', 'on']) {
      await evaluate('localStorage.setItem("smart-safar-data-saver", ' + JSON.stringify(mode) + ')');
      await navigate('/');
      await waitFor('document.documentElement.dataset.dataSaver === ' + JSON.stringify(mode), 'Saver setting');
      await pause(4000);
      measurements[mode] = await evaluate('performance.getEntriesByType("resource").filter(r=>r.name.includes("/_next/image") || r.name.includes("clocktower") || r.name.includes("smart-safar-transit-hero.webp") || r.name.includes("/images/cards/")).reduce((sum,r)=>sum+r.transferSize,0)');
    }
    assert.ok(measurements.off > measurements.on, 'Saver reduces decorative bytes');
    console.log('MEASURE Decorative image transfer bytes on Home: ' + JSON.stringify(measurements));
    // Data Saver preference persists across reload; normal launch artwork remains.
    assert.equal(await evaluate('localStorage.getItem("smart-safar-data-saver")'), 'on');

    await asUser(tokens.admin, '/admin/routes');
    await waitFor('document.body.innerText.includes("Browser verification route")', 'admin routes');
    await evaluate('[...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Add Route").click()');
    await waitFor('Boolean(document.getElementById("add-route-name"))', 'route creation form');
    await evaluate('(function(){const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;for(const [id,value] of [["add-route-name","Failure test route"],["add-route-start","Start"],["add-route-end","End"]]){const input=document.getElementById(id);set.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));}})()');
    failMutation = true;
    await evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
    await waitFor('document.body.innerText.includes("Failed to create route")', 'failed mutation feedback');
    await pause(1500);
    assert.equal(mutationAttempts, 1, 'Failed admin mutation is never automatically retried');
    assert.equal(await Route.countDocuments({ routeName: 'Failure test route' }), 0);
    console.log('PASS Production form network failure: one POST attempt, useful error, no duplicate submission');
    assert.deepEqual(errors, [], 'Browser runtime/hydration errors');
    console.log('PASS Shared-cache/offline/Data Saver checks; no runtime/hydration errors');
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
  finally {
    ws?.close(); chrome?.kill(); next?.kill();
    if (server.listening) { server.closeAllConnections(); await new Promise((resolve) => io.close(resolve)); }
    if (mongoose.connection.readyState === 1) { assert.equal(mongoose.connection.name, database); assert.ok(database.startsWith('transit_render_test_')); await mongoose.connection.dropDatabase(); }
    await mongoose.disconnect();
    for (const call of pending.values()) { clearTimeout(call.timer); call.reject(new Error('Browser closed')); }
    // The isolated Chrome profile is left in the OS temporary directory.
  }
})();
