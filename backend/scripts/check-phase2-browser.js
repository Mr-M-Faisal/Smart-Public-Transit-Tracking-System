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
let sequence = 0, sessionId, holdAnalytics = true;
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
  while (Date.now() < end) { if (await evaluate(expression)) return; await pause(150); }
  throw new Error('Timed out: ' + label + ' | ' + await evaluate('document.body.innerText.slice(0, 600)'));
}
async function navigate(route) {
  await command('Page.navigate', { url: 'http://localhost:3007' + route });
  await waitFor('Boolean(document.querySelector("main, .app-content, .app-auth-state"))', route + ' shell');
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
    profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-safar-phase2-'));
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
      if (message.method === 'Fetch.requestPaused') { const params = { requestId: message.params.requestId, url: message.params.request.url.replace('http://localhost:5000', 'http://localhost:' + server.address().port) }; if (holdAnalytics && message.params.request.url.includes('/api/admin/dashboard?section=analytics')) heldAnalytics.push(params); else command('Fetch.continueRequest', params).catch(() => {}); }
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
    await command('Network.setBypassServiceWorker', { bypass: true });
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
    await asUser(tokens.driver, '/driver/dashboard');
    await waitFor('document.body.innerText.includes("Browser driver")', 'driver home');
    for (const route of ['/driver/shift', '/driver/tracking', '/driver/seats']) { await clickRoute(route); await waitFor('document.body.innerText.includes("BROWSER-CHECK")', route + ' details'); }
    console.log('PASS Driver Home -> Shift -> Track -> Seats');
    const requestStart = requests.length;
    await asUser(tokens.admin, '/admin/dashboard');
    await waitFor('document.body.innerText.toLowerCase().includes("fleet size") && document.body.innerText.includes("BROWSER-CHECK")', 'admin dashboard');
    assert.ok(await evaluate('Boolean(document.querySelector(".app-content [aria-busy=true]"))'), 'Secondary skeleton while KPIs render');
    assert.ok(heldAnalytics.length, 'Analytics request held for progressive rendering test');
    holdAnalytics = false;
    for (const params of heldAnalytics.splice(0)) await command('Fetch.continueRequest', params);
    await waitFor('!document.querySelector(".app-content [aria-busy=true]")', 'dashboard sections');
    assert.ok(await evaluate('document.body.innerText.includes("Browser driver")'), 'Driver name preserved in compact fleet');
    const dashboardRequests = requests.slice(requestStart).filter((url) => url.includes('/api/admin/dashboard'));
    assert.equal(dashboardRequests.length, 3);
    assert.ok(!requests.slice(requestStart).some((url) => url.includes('/api/stops/route/')));
    await evaluate('[...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label")?.startsWith("Open notifications")).click()');
    await waitFor('document.body.innerText.includes("No active alerts")', 'aggregated notifications');
    assert.ok(requests.some((url) => url.includes('/api/route-alerts/active')));
    for (const route of ['/admin/buses', '/admin/routes', '/admin/stops']) { await clickRoute(route); await waitFor('document.body.innerText.includes(' + JSON.stringify(route.endsWith('buses') ? 'BROWSER-CHECK' : 'Browser verification route') + ')', route + ' rows'); }
    console.log('PASS Admin Dashboard -> Buses -> Routes -> Stops; 3 dashboard requests; aggregated notifications');
    await asUser(tokens.commuter, '/admin/dashboard');
    await waitFor('document.body.innerText.includes("permission")', 'commuter denied admin');
    await evaluate('localStorage.setItem("smart-safar-theme-v1", "orange")');
    await navigate('/routes');
    await waitFor('document.documentElement.dataset.theme === "orange"', 'orange theme restoration');
    assert.deepEqual(errors, [], 'Browser runtime/hydration errors');
    console.log('PASS Admin access denied to commuter; no runtime/hydration errors');
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
