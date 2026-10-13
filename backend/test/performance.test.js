const { test, before, after, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { gzipSync, gunzipSync } = require('node:zlib');
const jwt = require('jsonwebtoken');
const { io: connectSocket } = require('socket.io-client');
process.env.CORS_ORIGINS = 'https://frontend.example';
process.env.JWT_SECRET = 'performance-test-only-secret';
const { app, server, io } = require('../src/server');
const { createOriginPolicy } = require('../src/config/cors');
const Route = require('../src/models/Route');
const Bus = require('../src/models/Bus');
const User = require('../src/models/User');
const { protect, authorize } = require('../src/middleware/auth');
let baseUrl;
const body = { message: 'compressible JSON '.repeat(400) };
const encoded = gzipSync(JSON.stringify(body));
app.get('/test/compression', (_req, res) => res.json(body));
app.get('/test/encoded', (_req, res) => res.set('Content-Encoding', 'gzip').type('json').send(encoded));
app.get('/test/image', (_req, res) => res.type('png').send(Buffer.alloc(2048)));
app.get('/test/no-transform', (_req, res) => res.set('Cache-Control', 'no-transform').json(body));
app.get('/test/auth', protect, authorize('driver'), (req, res) => res.json(req.user));
before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});
afterEach(() => mock.restoreAll());
after(async () => { await new Promise((resolve) => io.close(resolve)); });
function request(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(baseUrl + path, { headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}
test('compressible JSON negotiates gzip and preserves content', async () => {
  const plain = await request('/test/compression', { 'Accept-Encoding': 'identity' });
  const zipped = await request('/test/compression', { 'Accept-Encoding': 'gzip' });
  assert.equal(zipped.headers['content-encoding'], 'gzip');
  assert.match(zipped.headers.vary, /Accept-Encoding/);
  assert.deepEqual(gunzipSync(zipped.body), plain.body);
  assert.ok(zipped.body.length < plain.body.length);
});
test('small, already encoded, binary and no-transform responses avoid unnecessary compression', async () => {
  for (const path of ['/', '/test/image', '/test/no-transform']) {
    assert.equal((await request(path, { 'Accept-Encoding': 'gzip' })).headers['content-encoding'], undefined);
  }
  const response = await request('/test/encoded', { 'Accept-Encoding': 'gzip' });
  assert.deepEqual(response.body, encoded);
});
test('exact origins, credentials and authenticated preflight are supported', async () => {
  const response = await fetch(baseUrl + '/api/buses', { method: 'OPTIONS', headers: {
    Origin: 'https://frontend.example', 'Access-Control-Request-Method': 'PATCH',
    'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://frontend.example');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('access-control-allow-headers'), /authorization/);
  assert.equal((await request('/', { Origin: 'https://frontend.example.evil' })).status, 403);
  const production = createOriginPolicy({ NODE_ENV: 'production', CORS_ORIGINS: 'https://frontend.example/' });
  assert.equal(production('https://frontend.example'), true);
  assert.equal(production('http://localhost:3000'), false);
  assert.equal(production('null'), false);
  assert.equal(production(undefined), true);
  assert.equal(createOriginPolicy({})('http://localhost:3000'), true);
  assert.throws(() => createOriginPolicy({ CORS_ORIGINS: '*' }));
});
test('Socket.IO permits allowed origins and rejects unlisted origins on both transports', async () => {
  for (const transport of ['polling', 'websocket']) {
    for (const allowed of [true, false]) {
      const socket = connectSocket(baseUrl, { transports: [transport], reconnection: false,
        extraHeaders: { Origin: allowed ? 'https://frontend.example' : 'https://unlisted.example' } });
      try {
        const event = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 4000);
          const finish = (name) => { clearTimeout(timeout); resolve(name); };
          socket.once('connect', () => finish('connect'));
          socket.once('connect_error', () => finish('connect_error'));
        });
        assert.equal(event, allowed ? 'connect' : 'connect_error');
      } finally { socket.disconnect(); }
    }
  }
});
test('route list projects geometry out while map opt-in and detail preserve both directions', async () => {
  const route = { _id: 'route', routeName: 'Route', startPoint: 'Start', endPoint: 'End',
    geometry: { outbound: [[31, 73], [32, 74]], return: [[32, 74], [31, 73]] } };
  mock.method(Route, 'find', (filter) => {
    assert.deepEqual(filter, { isActive: true });
    let projection;
    return { select(value) { projection = value; return this; }, sort(value) {
      assert.deepEqual(value, { createdAt: -1 }); return this;
    }, async lean() { const value = { ...route }; if (projection === '-geometry') delete value.geometry; else assert.equal(projection, ''); return [value]; } };
  });
  mock.method(Route, 'findById', async () => route);
  const list = JSON.parse((await request('/api/routes')).body);
  assert.equal(Object.hasOwn(list[0], 'geometry'), false);
  assert.equal(list[0].startPoint, 'Start');
  const map = JSON.parse((await request('/api/routes?includeGeometry=true')).body);
  assert.deepEqual(map[0].geometry, route.geometry);
  const detail = JSON.parse((await request('/api/routes/route')).body);
  assert.deepEqual(detail.geometry, route.geometry);
});
test('bus lists exclude seats at query time; details retain sanitized individual seats', async () => {
  const bus = { _id: 'bus', busNumber: 'Bus', capacity: 1, availableSeats: 0, direction: 'return',
    seatMap: [{ label: 'A1', row: 0, column: 0, status: 'booked', booking: 'private-booking-id' }], recentSpeeds: [10] };
  mock.method(Bus, 'find', (filter) => {
    assert.deepEqual(filter, { route: 'route' });
    return { select(value) { assert.equal(value, '-seatMap -recentSpeeds'); return this; }, populate() { return this; }, async lean() {
      const { seatMap, recentSpeeds, ...summary } = bus; return [summary];
    } };
  });
  mock.method(Bus, 'findById', () => ({ populate() { return this; }, then(resolve) { return Promise.resolve(bus).then(resolve); } }));
  const list = JSON.parse((await request('/api/buses?route=route')).body);
  assert.equal(Object.hasOwn(list[0], 'seatMap'), false);
  assert.equal(list[0].availableSeats, 0);
  assert.equal(list[0].direction, 'return');
  const detail = JSON.parse((await request('/api/buses/bus')).body);
  assert.equal(detail.seatMap[0].status, 'booked');
  assert.equal(Object.hasOwn(detail.seatMap[0], 'booking'), false);
});
test('protected requests re-read current roles, assignments and account existence', async () => {
  let user = { _id: 'driver', role: 'driver', assignedBus: 'first' };
  let reads = 0;
  mock.method(User, 'findById', () => ({ select(value) { assert.equal(value, '_id role assignedBus'); return this; }, async lean() { reads += 1; return user; } }));
  const headers = { Authorization: 'Bearer ' + jwt.sign({ id: 'driver' }, process.env.JWT_SECRET) };
  assert.equal(JSON.parse((await request('/test/auth', headers)).body).assignedBus, 'first');
  user = { ...user, assignedBus: 'second' };
  assert.equal(JSON.parse((await request('/test/auth', headers)).body).assignedBus, 'second');
  user = { ...user, role: 'commuter' };
  assert.equal((await request('/test/auth', headers)).status, 403);
  user = null;
  assert.equal((await request('/test/auth', headers)).status, 401);
  assert.equal(reads, 4);
});
