const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { io: createSocket } = require('socket.io-client');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.BOOKING_FARE = '50';
process.env.BOOKING_CURRENCY = 'PKR';
const { server, io } = require('../src/server');
const User = require('../src/models/User');
const Bus = require('../src/models/Bus');
const Route = require('../src/models/Route');
const Stop = require('../src/models/Stop');
const Booking = require('../src/models/Booking');
const Shift = require('../src/models/Shift');

const database = 'transit_seats_test_' + crypto.randomBytes(8).toString('hex');
const password = crypto.randomBytes(18).toString('hex');
let baseUrl, adminToken, driverToken, otherDriverToken, commuterToken, secondCommuterToken, route, bus;

async function request(path, token, method = 'GET', body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(45000),
  });
  return { status: response.status, data: await response.json() };
}

async function account(email, role) {
  await User.create({ name: role + ' integration', email, password, role });
  const login = await request('/api/auth/login', null, 'POST', { email, password });
  assert.equal(login.status, 200);
  return login.data;
}

before(async () => {
  const uri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
  assert.ok(uri, 'Configure TEST_MONGO_URI or MONGO_URI');
  await mongoose.connect(uri, { dbName: database, serverSelectionTimeoutMS: 10000 });
  assert.equal(mongoose.connection.name, database);
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.ok(topology.setName || topology.msg === 'isdbgrid', 'Transactions require a replica set or sharded cluster');
  for (const model of [User, Bus, Route, Stop, Booking, Shift]) await model.init();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  adminToken = (await account('seats-admin@integration.example', 'admin')).token;
  const driver = await account('seats-driver@integration.example', 'driver');
  driverToken = driver.token;
  otherDriverToken = (await account('seats-other-driver@integration.example', 'driver')).token;
  commuterToken = (await account('seats-commuter@integration.example', 'commuter')).token;
  secondCommuterToken = (await account('seats-second@integration.example', 'commuter')).token;
  const createdRoute = await request('/api/routes', adminToken, 'POST', { routeName: 'Seat Test Route', startPoint: 'Start', endPoint: 'End' });
  assert.equal(createdRoute.status, 201);
  route = createdRoute.data;
  assert.equal((await request('/api/stops', adminToken, 'POST', { route: route._id, stopName: 'Stop', latitude: 31.42, longitude: 73.082, stopOrder: 1 })).status, 201);
  const createdBus = await request('/api/buses', adminToken, 'POST', { busNumber: 'SEAT-TEST-01', route: route._id, capacity: 6, seatLayout: 'A1,A2,_,A3\nB1,B2,_,B3' });
  assert.equal(createdBus.status, 201);
  bus = createdBus.data;
  assert.equal(bus.seatMap.length, 6);
  assert.equal((await request('/api/buses/' + bus._id, adminToken, 'PUT', { driver: driver._id })).status, 200);
  assert.equal((await request('/api/buses/assigned/start-shift', driverToken, 'POST')).status, 201);
}, { timeout: 180000 });

after(async () => {
  if (server.listening) { server.closeAllConnections(); await new Promise((resolve) => io.close(resolve)); }
  try {
    if (mongoose.connection.readyState === 1) {
      assert.equal(mongoose.connection.name, database);
      assert.ok(database.startsWith('transit_seats_test_'));
      await mongoose.connection.dropDatabase();
    }
  } finally { await mongoose.disconnect(); }
}, { timeout: 45000 });

test('admin section configuration creates labelled front-to-back individual seats', { timeout: 45000 }, async () => {
  const created = await request('/api/buses', adminToken, 'POST', {
    busNumber: 'SEAT-SECTION-01', route: route._id, capacity: 6, gentsSeats: 2, ladiesSeats: 4,
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.data.seatSections, { gents: 2, ladies: 4 });
  assert.deepEqual(created.data.seatMap.map((seat) => seat.label), ['G01', 'G02', 'W01', 'W02', 'W03', 'W04']);
  assert.deepEqual(created.data.seatMap.map((seat) => seat.section), ['gents', 'gents', 'ladies', 'ladies', 'ladies', 'ladies']);
  assert.ok(created.data.seatMap.filter((seat) => seat.section === 'ladies').every((seat) => seat.row > created.data.seatMap.find((seat) => seat.section === 'gents').row));
  const invalid = await request('/api/buses', adminToken, 'POST', {
    busNumber: 'SEAT-SECTION-INVALID', route: route._id, capacity: 6, gentsSeats: 2, ladiesSeats: 3,
  });
  assert.equal(invalid.status, 400);
});

test('configured seats stay consistent across driver, booking, concurrency, and sockets', { timeout: 240000 }, async () => {
  const endpoint = (seat) => `/api/buses/${bus._id}/seats/${seat}`;
  assert.equal((await request(endpoint('A1'), otherDriverToken, 'PATCH', { action: 'occupy' })).status, 403);
  const walkIn = await request(endpoint('B2'), driverToken, 'PATCH', { action: 'occupy' });
  assert.equal(walkIn.status, 200);
  assert.equal(walkIn.data.availableSeats, 5);
  assert.equal(walkIn.data.seatMap.find((seat) => seat.label === 'B2').status, 'occupied');
  assert.equal((await request('/api/bookings', commuterToken, 'POST', { routeId: route._id, bus: bus._id, seatNumber: 'B2', paymentMethod: 'cash' })).status, 409);

  const booked = await request('/api/bookings', commuterToken, 'POST', { routeId: route._id, bus: bus._id, seatNumber: 'A1', paymentMethod: 'cash' });
  assert.equal(booked.status, 201);
  assert.equal(booked.data.seatNumber, 'A1');
  assert.equal((await request('/api/bookings', secondCommuterToken, 'POST', { routeId: route._id, bus: bus._id, seatNumber: 'A1', paymentMethod: 'cash' })).status, 409);
  assert.equal((await request(endpoint('A1'), driverToken, 'PATCH', { action: 'occupy' })).status, 409);
  assert.equal((await request(endpoint('A1'), driverToken, 'PATCH', { action: 'release' })).status, 409);
  assert.equal((await request(`/api/buses/${bus._id}`, adminToken, 'PUT', { seatLayout: 'A1,A2,_,A3\nB1,B2,_,B3' })).status, 200);
  assert.equal((await request(`/api/buses/${bus._id}`, adminToken, 'PUT', { seatLayout: 'A1,A2,_,A3\nB1,B2,_,C3' })).status, 409);
  assert.equal((await request(`/api/buses/${bus._id}/seats`, driverToken, 'PATCH', { availableSeats: 6 })).status, 409);

  const results = await Promise.all([
    request(endpoint('A3'), driverToken, 'PATCH', { action: 'occupy' }),
    request('/api/bookings', secondCommuterToken, 'POST', { routeId: route._id, bus: bus._id, seatNumber: 'A3', paymentMethod: 'cash' }),
  ]);
  assert.equal(results.filter((result) => result.status >= 200 && result.status < 300).length, 1);
  const publicBus = await request(`/api/buses/${bus._id}`);
  assert.equal(publicBus.status, 200);
  assert.equal(publicBus.data.seatMap.find((seat) => seat.label === 'A3').status === 'available', false);
  assert.equal(publicBus.data.availableSeats, publicBus.data.seatMap.filter((seat) => seat.status === 'available').length);
  assert.ok(publicBus.data.seatMap.every((seat) => !Object.hasOwn(seat, 'booking')));

  const socket = createSocket(baseUrl, { transports: ['websocket'], reconnection: false, timeout: 5000 });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  socket.emit('watchBus', bus._id);
  for (let n = 0; n < 100 && !io.sockets.adapter.rooms.has('bus:' + bus._id); n++) await new Promise((resolve) => setTimeout(resolve, 25));
  const event = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Seat update not delivered')), 8000);
    socket.once('seatMapUpdate', (payload) => { clearTimeout(timeout); resolve(payload); });
  });
  assert.equal((await request(endpoint('A2'), driverToken, 'PATCH', { action: 'occupy' })).status, 200);
  const payload = await event;
  assert.equal(payload.busId, bus._id);
  assert.equal(payload.seatMap.find((seat) => seat.label === 'A2').status, 'occupied');
  assert.ok(payload.seatMap.every((seat) => !Object.hasOwn(seat, 'booking')));
  socket.disconnect();

  assert.equal((await request(endpoint('B2'), driverToken, 'PATCH', { action: 'release' })).status, 200);
  assert.equal((await request(`/api/bookings/${booked.data._id}/cancel`, commuterToken, 'PATCH')).status, 200);
  const finalBus = await request(`/api/buses/${bus._id}`);
  assert.equal(finalBus.data.seatMap.find((seat) => seat.label === 'B2').status, 'available');
  assert.equal(finalBus.data.seatMap.find((seat) => seat.label === 'A1').status, 'available');
  assert.equal(finalBus.data.availableSeats, finalBus.data.seatMap.filter((seat) => seat.status === 'available').length);
});

// Real MongoDB contract coverage complements the isolated middleware tests.
test('fleet summaries omit seats while route detail and map opt-in preserve geometry', async () => {
  const geometry = { outbound: [[31.42, 73.08], [31.43, 73.09]], return: [[31.43, 73.09], [31.42, 73.08]] };
  await Route.findByIdAndUpdate(route._id, { geometry });
  const routes = await request('/api/routes');
  assert.equal(routes.status, 200);
  assert.equal(Object.hasOwn(routes.data.find((item) => item._id === route._id), 'geometry'), false);
  const detailed = await request('/api/routes/' + route._id);
  assert.deepEqual(detailed.data.geometry, geometry);
  const mapped = await request('/api/routes?includeGeometry=true');
  assert.deepEqual(mapped.data.find((item) => item._id === route._id).geometry, geometry);
  const fleet = await request('/api/buses?route=' + route._id);
  assert.equal(fleet.status, 200);
  assert.ok(fleet.data.length);
  assert.ok(fleet.data.every((item) => !Object.hasOwn(item, 'seatMap')));
  const detail = await request('/api/buses/' + bus._id);
  assert.equal(detail.data.seatMap.length, 6);
  assert.ok(detail.data.seatMap.every((seat) => !Object.hasOwn(seat, 'booking')));
});
