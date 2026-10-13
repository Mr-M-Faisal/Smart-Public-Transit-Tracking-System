const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { QueryClient } = require('@tanstack/react-query');
const axios = require('axios');
const paths = { routes: '/api/routes', stops: '/api/stops', buses: '/api/buses', alerts: '/api/route-alerts', bookings: '/api/bookings' };
async function load(file, dependencies, extras = {}) {
  const context = vm.createContext({ window: {}, navigator: { onLine: true }, setTimeout, clearTimeout, console, ...extras });
  const loadedModule = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { context });
  await loadedModule.link((name) => { const values = dependencies[name]; assert.ok(values, name); return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context }); });
  await loadedModule.evaluate();
  return { exports: loadedModule.namespace, context };
}
async function cache(saved) {
  const writes = [], calls = [];
  let handler = async (url) => url === paths.buses ? [{ _id: 'bus', busNumber: 'B1', route: 'r', capacity: 2, seatMap: ['private'], currentLocation: { latitude: 1 } }] : [{ _id: 'r', routeName: 'Saved route' }];
  const result = await load('lib/query/transitQueries.js', {
    '@tanstack/react-query': { QueryClient }, '../api/axios': { default: { get: async (url, config) => { calls.push(url); return { data: await handler(url, config) }; } } },
    '../../config/api': { API_PATHS: paths },
    '../live-map/liveMapStorage': { readPublicQueries: async () => saved, savePublicQueries: async (value) => writes.push(JSON.parse(JSON.stringify(value))), readCachedRoutes: async () => null, readTransitSnapshot: async () => null },
  });
  return { ...result, writes, calls, setHandler: (value) => { handler = value; } };
}
test('reference reads deduplicate, reuse fresh data, invalidate after mutations and retain data on failed refresh', async () => {
  const { exports: q, calls, setHandler } = await cache();
  try {
    const option = q.transitQueries.routes();
    const values = await Promise.all([q.readQuery(option), q.readQuery(option)]);
    assert.equal(calls.length, 1); assert.equal(values[0], values[1]);
    await q.readQuery(option); assert.equal(calls.length, 1);
    await q.invalidateTransit(['routes']); await q.readQuery(option); assert.equal(calls.length, 2);
    setHandler(async () => { throw new Error('Network down'); });
    await assert.rejects(q.readQuery({ ...option, staleTime: 0 }));
    assert.equal(q.getQueryClient().getQueryData(option.queryKey)[0].routeName, 'Saved route');
  } finally { q.getQueryClient().clear(); }
});
test('cold offline restoration retains geometry and timestamps; only allow-listed references and bus metadata persist', async () => {
  const timestamp = Date.now() - 120000;
  const entry = { queryKey: ['transit', 'route', 'r'], data: { _id: 'r', geometry: { outbound: [[1,2]], return: [[2,1]] } }, updatedAt: timestamp };
  const { exports: q, context, calls, writes } = await cache({ data: [entry] });
  try {
    context.navigator.onLine = false;
    const route = await q.readQuery(q.transitQueries.route('r'));
    assert.deepEqual(route.geometry.return, [[2,1]]); assert.equal(calls.length, 0);
    assert.equal(q.getQueryClient().getQueryState(entry.queryKey).dataUpdatedAt, timestamp);
    context.navigator.onLine = true;
    await q.readQuery(q.transitQueries.buses());
    q.getQueryClient().setQueryData(['transit', 'alerts', 'SECRET-TOKEN'], [{ message: 'Private alert' }]);
    await q.persistQueries();
    const serialized = JSON.stringify(writes.at(-1));
    assert.ok(serialized.includes('busMetadata'));
    for (const secret of ['SECRET-TOKEN', 'Private alert', 'seatMap', 'currentLocation']) assert.ok(!serialized.includes(secret), secret);
    await q.invalidateTransit(['route']);
    assert.ok(!writes.at(-1).some((item) => item.queryKey[1] === 'route'));
  } finally { q.getQueryClient().clear(); }
});
test('offline operational reads fail promptly instead of using stale seats', async () => {
  const { exports: q, context } = await cache();
  try {
    q.getQueryClient().setQueryData(['transit', 'bus', 'bus'], { seatMap: ['old'] });
    context.navigator.onLine = false;
    await assert.rejects(q.readQuery({ ...q.transitQueries.bus('bus'), staleTime: 0 }), /Offline/);
  } finally { q.getQueryClient().clear(); }
});
test('Axios retries a transient GET once, never mutations/cancellation/auth failures, with a finite timeout', async () => {
  let cleared = 0;
  const { exports: loadedModule } = await load('lib/api/axios.js', {
    axios: { default: axios }, '../../config/api': { API_URL: '', API_PATHS: paths },
    '../auth/token': { getAccessToken: () => 'test', clearAccessToken: () => { cleared++; } },
  }, { setTimeout: (callback) => setTimeout(callback, 0) });
  const api = loadedModule.default;
  assert.equal(api.defaults.timeout, 15000);
  for (const [method, status, expected] of [['get', 503, 2], ['post', 503, 1], ['put', 503, 1], ['patch', 503, 1], ['delete', 503, 1], ['get', 401, 1], ['get', 403, 1]]) {
    let count = 0;
    await assert.rejects(api.request({ method, url: '/test', adapter: async (config) => { count++; throw new axios.AxiosError('Failure', 'ERR_BAD_RESPONSE', config, null, { status }); } }));
    assert.equal(count, expected, method + ' ' + status);
  }
  assert.equal(cleared, 1);
  let count = 0;
  await assert.rejects(api.get('/test', { adapter: async (config) => { count++; throw new axios.CanceledError('Cancelled', config); } }));
  assert.equal(count, 1);
});
