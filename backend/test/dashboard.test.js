const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const Bus = require('../src/models/Bus');
const Route = require('../src/models/Route');
const Booking = require('../src/models/Booking');
const Report = require('../src/models/Report');
const RouteStop = require('../src/models/RouteStop');
const Stop = require('../src/models/Stop');
const { dashboardData } = require('../src/services/dashboardService');
const { getStopsForRoutes } = require('../src/services/routeStopService');
afterEach(() => mock.restoreAll());
function query(data) { return { select() { return this; }, sort() { return this; }, populate() { return this; }, lean() { return this; }, exec() { return Promise.resolve(data); }, then(resolve, reject) { return Promise.resolve(data).then(resolve, reject); } }; }
test('a report query failure preserves booking analytics and hides database error details', async () => {
  const bookings = [{ _id: '2026-10-13', totalBookings: 2, totalRevenue: 100, cancelled: 0 }];
  mock.method(Booking, 'aggregate', async () => bookings);
  mock.method(Report, 'aggregate', async () => { throw new Error('private database details'); });
  const result = await dashboardData('analytics');
  assert.deepEqual(result.bookings, { status: 'ready', data: bookings });
  assert.equal(result.reports.status, 'error');
  assert.ok(!JSON.stringify(result).includes('private database details'));
});
test('transit queries read the fleet once and preserve fleet/occupancy when routes fail', async () => {
  const fleet = [{ route: { _id: 'r1', routeName: 'Route' }, capacity: 20, availableSeats: 5 }];
  const readFleet = mock.method(Bus, 'find', () => query(fleet));
  const readRoutes = mock.method(Route, 'find', () => { const q = query([]); q.exec = () => Promise.reject(new Error('unavailable')); return q; });
  const result = await dashboardData('transit');
  assert.equal(readFleet.mock.calls.length, 1);
  assert.equal(readRoutes.mock.calls.length, 1);
  assert.equal(result.routes.status, 'error');
  assert.equal(result.stops.status, 'error');
  assert.deepEqual(result.buses.data, fleet);
  assert.equal(result.occupancy.data[0].averageOccupancy, 75);
});
test('batched stops retain shared route memberships and merge legacy rows once per route', async () => {
  const shared = { _id: 'shared', stopName: 'Shared physical stop' };
  const links = mock.method(RouteStop, 'find', () => query([
    { _id: 'link1', route: 'r1', stop: shared, stopOrder: 2 },
    { _id: 'link2', route: 'r2', stop: shared, stopOrder: 1 },
  ]));
  const legacy = mock.method(Stop, 'find', () => query([
    { ...shared, route: 'r1', stopOrder: 2 }, { _id: 'legacy', route: 'r1', stopOrder: 1 },
  ]));
  const result = await getStopsForRoutes(['r1', 'r2']);
  assert.deepEqual(result.map((item) => [item.route, item._id]), [['r1', 'legacy'], ['r1', 'shared'], ['r2', 'shared']]);
  assert.equal(links.mock.calls.length, 1);
  assert.equal(legacy.mock.calls.length, 1);
  assert.deepEqual(await getStopsForRoutes([]), []);
  assert.equal(links.mock.calls.length, 1);
});
