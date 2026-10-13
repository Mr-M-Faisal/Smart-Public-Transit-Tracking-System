const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { io: createSocket } = require('socket.io-client');

// All HTTP handlers, middleware, hashing and persistence are the actual backend.
// A separate, uniquely named database prevents fixtures reaching the live fleet.
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.BOOKING_FARE = '50';
process.env.BOOKING_CURRENCY = 'PKR';
process.env.PAYMENT_WEBHOOK_SECRET = crypto.randomBytes(32).toString('hex');
const { server, io } = require('../src/server');
const User = require('../src/models/User');
const Bus = require('../src/models/Bus');
const Route = require('../src/models/Route');
const Stop = require('../src/models/Stop');
const Booking = require('../src/models/Booking');
const Report = require('../src/models/Report');
const RouteAlert = require('../src/models/RouteAlert');
const SafetySession = require('../src/models/SafetySession');
const Shift = require('../src/models/Shift');

const testDatabase = 'transit_driver_test_' + crypto.randomBytes(8).toString('hex');
const password = crypto.randomBytes(18).toString('hex');
let baseUrl, adminToken, commuter, commuterToken, driverA, driverB, driverTokenA, driverTokenB, route, busA, busB, routeFirstBooking, routeFirstContext;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, token, method = 'GET', body, extraHeaders = {}) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(45000),
  });
  return { status: response.status, data: await response.json() };
}

function paymentSignature(body) {
  const message = JSON.stringify([
    body.paymentReference,
    body.status,
    Number(body.amount),
    body.currency.toUpperCase(),
    body.providerTransactionId,
    body.failureReason || null,
  ]);
  return crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET).update(message).digest('hex');
}

function assertSafeDriver(record) {
  const allowed = ['_id', 'name', 'email', 'phone', 'role', 'assignedBus', 'createdAt', 'updatedAt'];
  assert.ok(Object.keys(record).every((key) => allowed.includes(key)));
  assert.equal(record.role, 'driver');
  assert.ok(record._id && record.email);
}

async function login(email, suppliedPassword = password) {
  const result = await request('/api/auth/login', null, 'POST', { email, password: suppliedPassword });
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.data).sort(), ['_id', 'email', 'name', 'role', 'token']);
  return result.data;
}

async function createDriver(email, name = 'Integration Driver') {
  const result = await request('/api/admin/drivers', adminToken, 'POST', { name, email, password, phone: '03001234567' });
  assert.equal(result.status, 201);
  assertSafeDriver(result.data);
  return result.data;
}

async function assign(bus, driver) {
  return request('/api/buses/' + bus._id, adminToken, 'PUT', { driver: driver ? driver._id : null });
}

function requireRouteFirstContext() {
  assert.ok(routeFirstContext, 'Route-first booking fixture is missing; the route-first booking test must run first.');
  assert.ok(routeFirstBooking, 'Route-first booking is missing; the route-first booking test did not create its prerequisite booking.');
  return routeFirstContext;
}

async function createRouteFirstFixture() {
  const fixtureId = crypto.randomBytes(6).toString('hex');
  const driver = await createDriver(`route-first-driver-${fixtureId}@integration.example`, 'Route-first Driver');
  const driverIdentity = await login(driver.email);
  const routeResponse = await request('/api/routes', adminToken, 'POST', {
    routeName: `Route-first ${fixtureId}`,
    startPoint: 'Route-first Start',
    endPoint: 'Route-first End',
  });
  assert.equal(routeResponse.status, 201);
  const fixtureRoute = routeResponse.data;
  const stopResponse = await request('/api/stops', adminToken, 'POST', {
    route: fixtureRoute._id,
    stopName: 'Route-first Stop',
    latitude: 31.45,
    longitude: 73.11,
    stopOrder: 1,
  });
  assert.equal(stopResponse.status, 201);
  const busResponse = await request('/api/buses', adminToken, 'POST', {
    busNumber: `ROUTE-FIRST-${fixtureId}`,
    route: fixtureRoute._id,
    capacity: 12,
    driver: driver._id,
  });
  assert.equal(busResponse.status, 201);
  const fixtureBus = busResponse.data;
  const started = await request('/api/buses/assigned/start-shift', driverIdentity.token, 'POST');
  assert.equal(started.status, 201, `Route-first fixture shift did not start: ${JSON.stringify(started.data)}`);
  const passenger = await request('/api/auth/register', null, 'POST', {
    name: 'Route-first Passenger',
    email: `route-first-passenger-${fixtureId}@integration.example`,
    password,
  });
  assert.equal(passenger.status, 201);
  return { fixtureId, route: fixtureRoute, bus: fixtureBus, driver, driverToken: driverIdentity.token, passengerToken: passenger.data.token };
}

async function profile(token) {
  const result = await request('/api/auth/profile', token);
  assert.equal(result.status, 200);
  assert.equal(Object.hasOwn(result.data, 'password'), false);
  return result.data;
}

async function assertLinks(bus, driver) {
  const fleet = await request('/api/buses/' + bus._id);
  assert.equal(fleet.status, 200);
  assert.equal(fleet.data.driver?._id || null, driver ? driver._id : null);
  if (driver) {
    const saved = await User.findById(driver._id).select('assignedBus');
    assert.equal(String(saved.assignedBus), bus._id);
  }
}

before(async () => {
  const uri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
  assert.ok(uri, 'Configure TEST_MONGO_URI or the existing backend MONGO_URI');
  await mongoose.connect(uri, { dbName: testDatabase, serverSelectionTimeoutMS: 10000 });
  assert.equal(mongoose.connection.name, testDatabase);
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.ok(topology.setName || topology.msg === 'isdbgrid', 'Integration tests require transaction-capable MongoDB');
  for (const model of [User, Bus, Route, Stop, Booking, Report, RouteAlert, SafetySession, Shift]) await model.init();
  const admin = await User.create({ name: 'Integration Admin', email: 'admin@integration.example', password, role: 'admin' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  const identity = await login(admin.email);
  assert.equal(identity.role, 'admin');
  adminToken = identity.token;
  const createdRoute = await request('/api/routes', adminToken, 'POST', { routeName: 'Integration Route', startPoint: 'Start', endPoint: 'End' });
  assert.equal(createdRoute.status, 201);
  route = createdRoute.data;
  const stop = await request('/api/stops', adminToken, 'POST', { route: route._id, stopName: 'Integration Stop', latitude: 31.42, longitude: 73.082, stopOrder: 1 });
  assert.equal(stop.status, 201);
  for (const number of ['INTEGRATION-A', 'INTEGRATION-B']) {
    const result = await request('/api/buses', adminToken, 'POST', { busNumber: number, route: route._id, capacity: 40 });
    assert.equal(result.status, 201);
    assert.equal(result.data.availableSeats, 40);
    assert.equal(result.data.direction, 'outbound');
    if (!busA) busA = result.data; else busB = result.data;
  }
}, { timeout: 60000 });

after(async () => {
  if (server.listening) {
    server.closeAllConnections();
    await new Promise((resolve) => io.close(resolve));
  }
  try {
    // Drop only the uniquely named database this process selected explicitly.
    if (mongoose.connection.readyState === 1) {
      assert.equal(mongoose.connection.name, testDatabase);
      assert.ok(testDatabase.startsWith('transit_driver_test_'));
      await mongoose.connection.dropDatabase();
    }
  } finally {
    await mongoose.disconnect();
  }
}, { timeout: 30000 });

test('normal commuter registration remains compatible', async () => {
  const result = await request('/api/auth/register', null, 'POST', { name: 'Integration Commuter', email: 'commuter@integration.example', password });
  assert.equal(result.status, 201);
  assert.equal(result.data.role, 'commuter');
  assert.ok(result.data.token);
  assert.equal(Object.hasOwn(result.data, 'password'), false);
  commuter = result.data;
  commuterToken = result.data.token;
});

for (const role of ['admin', 'driver']) {
  test('public registration rejects privileged role ' + role, async () => {
    const email = role + '-blocked@integration.example';
    const result = await request('/api/auth/register', null, 'POST', { name: 'Blocked role', email, password, role });
    assert.equal(result.status, 400);
    assert.equal(await User.exists({ email }), null);
  });
}

test('admin creates hashed driver accounts with safe responses and a preserved admin session', async () => {
  driverA = await createDriver('driver.a@integration.example', 'Integration Driver A');
  driverB = await createDriver('driver.b@integration.example', 'Integration Driver B');
  assert.equal(driverA.assignedBus, null);
  const stored = await User.findById(driverA._id);
  assert.notEqual(stored.password, password);
  assert.ok(stored.password.startsWith('$2'));
  assert.equal(await stored.matchPassword(password), true);
  assert.equal((await profile(adminToken)).role, 'admin');
  const directory = await request('/api/admin/drivers', adminToken);
  assert.equal(directory.status, 200);
  assert.deepEqual(directory.data.map((item) => item._id).sort(), [driverA._id, driverB._id].sort());
  directory.data.forEach(assertSafeDriver);
});

test('creation validates actual fields and rejects duplicate or privileged account fields', async () => {
  const valid = { name: 'Driver', email: 'invalid-create@integration.example', password };
  for (const body of [{ ...valid, name: ' ' }, { ...valid, email: 'invalid' }, { ...valid, password: 'short' }, { ...valid, phone: 123 }, { ...valid, role: 'admin' }, { ...valid, assignedBus: busA._id }]) {
    const result = await request('/api/admin/drivers', adminToken, 'POST', body);
    assert.equal(result.status, 400);
    assert.deepEqual(Object.keys(result.data), ['message']);
  }
  const duplicate = await request('/api/admin/drivers', adminToken, 'POST', { ...valid, email: ' DRIVER.A@INTEGRATION.EXAMPLE ' });
  assert.equal(duplicate.status, 409);
  const raceBody = { ...valid, email: 'creation-race@integration.example' };
  const race = await Promise.all([request('/api/admin/drivers', adminToken, 'POST', raceBody), request('/api/admin/drivers', adminToken, 'POST', raceBody)]);
  assert.deepEqual(race.map((result) => result.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments({ email: raceBody.email }), 1);
});

test('driver update allows only name/email/phone and handles invalid IDs and duplicates', async () => {
  const result = await request('/api/admin/drivers/' + driverA._id, adminToken, 'PUT', { name: 'Updated Driver A', email: ' DRIVER.A.UPDATED@INTEGRATION.EXAMPLE ', phone: ' 03007654321 ' });
  assert.equal(result.status, 200);
  assertSafeDriver(result.data);
  assert.equal(result.data.email, 'driver.a.updated@integration.example');
  assert.equal(result.data.phone, '03007654321');
  driverA = result.data;
  for (const body of [{ role: 'admin' }, { password }, { assignedBus: busA._id }, { status: 'active' }]) {
    assert.equal((await request('/api/admin/drivers/' + driverA._id, adminToken, 'PUT', body)).status, 400);
  }
  assert.equal((await request('/api/admin/drivers/' + driverA._id, adminToken, 'PUT', { email: driverB.email })).status, 409);
  assert.equal((await request('/api/admin/drivers/invalid', adminToken, 'PUT', { name: 'Driver' })).status, 400);
  assert.equal((await request('/api/admin/drivers/' + new mongoose.Types.ObjectId(), adminToken, 'PUT', { name: 'Driver' })).status, 404);
  assert.equal((await request('/api/admin/drivers/' + commuter._id, adminToken, 'PUT', { name: 'Driver' })).status, 404);
});

test('existing login supports admin-created drivers and rejects wrong passwords', async () => {
  const identityA = await login(driverA.email);
  const identityB = await login(driverB.email);
  assert.equal(identityA.role, 'driver');
  assert.equal(identityB.role, 'driver');
  driverTokenA = identityA.token;
  driverTokenB = identityB.token;
  const wrong = await request('/api/auth/login', null, 'POST', { email: driverA.email, password: password + 'wrong' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.data.message, 'Invalid credentials');
});

test('all driver management operations and assignment enforce database-backed admin authorization', async () => {
  const operations = [
    ['/api/admin/drivers', 'GET'],
    ['/api/admin/drivers', 'POST', { name: 'Driver', email: 'unauthorized@integration.example', password }],
    ['/api/admin/drivers/' + driverA._id, 'PUT', { name: 'Driver' }],
    ['/api/admin/drivers/' + driverA._id, 'DELETE'],
    ['/api/buses/' + busA._id, 'PUT', { driver: driverA._id }],
  ];
  for (const [path, method, body] of operations) {
    assert.equal((await request(path, null, method, body)).status, 401);
    assert.equal((await request(path, driverTokenA, method, body)).status, 403);
    assert.equal((await request(path, commuterToken, method, body)).status, 403);
  }
  assert.equal((await request('/api/admin/drivers', adminToken + 'invalid')).status, 401);
  assert.equal(await User.exists({ email: 'unauthorized@integration.example' }), null);
});

test('assignment persists both records and remains compatible with populated fleet responses', async () => {
  const result = await assign(busA, driverA);
  assert.equal(result.status, 200);
  assert.equal(result.data.driver, driverA._id);
  assert.equal(result.data.route, route._id);
  await assertLinks(busA, driverA);
  const fleet = await request('/api/buses');
  assert.equal(fleet.status, 200);
  const saved = fleet.data.find((bus) => bus._id === busA._id);
  assert.deepEqual(Object.keys(saved.driver).sort(), ['_id', 'name', 'phone']);
  assert.equal(saved.route.routeName, route.routeName);
  assert.equal((await profile(driverTokenA)).assignedBus, busA._id);
  assert.equal((await assign(busA, driverA)).status, 200);
  const freshIdentity = await login(driverA.email);
  assert.equal((await profile(freshIdentity.token)).assignedBus, busA._id);
  assert.equal((await profile(freshIdentity.token)).assignedBus, busA._id);
});

test('changing a bus driver clears the previous profile and sets the new profile', async () => {
  assert.equal((await assign(busA, driverB)).status, 200);
  await assertLinks(busA, driverB);
  assert.equal((await profile(driverTokenA)).assignedBus, null);
  assert.equal((await profile(driverTokenB)).assignedBus, busA._id);
});

test('already assigned drivers return 409 without changing either assignment', async () => {
  const conflict = await assign(busB, driverB);
  assert.equal(conflict.status, 409);
  await assertLinks(busA, driverB);
  await assertLinks(busB, null);
  const directory = await request('/api/admin/drivers', adminToken);
  assert.equal(directory.data.find((driver) => driver._id === driverB._id).assignedBus, busA._id);
});

test('unassignment clears both sides and repeating it is safe', async () => {
  assert.equal((await assign(busA, null)).status, 200);
  await assertLinks(busA, null);
  assert.equal((await profile(driverTokenB)).assignedBus, null);
  assert.equal((await assign(busA, null)).status, 200);
});

test('a failed bus validation rolls back earlier profile writes in the same transaction', async () => {
  assert.equal((await assign(busA, driverA)).status, 200);
  const failed = await request('/api/buses/' + busA._id, adminToken, 'PUT', { driver: driverB._id, status: 'invalid-status' });
  assert.equal(failed.status, 400);
  await assertLinks(busA, driverA);
  assert.equal((await profile(driverTokenB)).assignedBus, null);
  assert.equal((await assign(busA, null)).status, 200);
});

test('invalid/missing/non-driver assignment references cannot mutate the relationship', async () => {
  assert.equal((await request('/api/buses/invalid', adminToken, 'PUT', { driver: driverA._id })).status, 400);
  assert.equal((await request('/api/buses/' + new mongoose.Types.ObjectId(), adminToken, 'PUT', { driver: driverA._id })).status, 404);
  for (const [driver, status] of [['invalid', 400], [new mongoose.Types.ObjectId().toString(), 404], [commuter._id, 400]]) {
    assert.equal((await request('/api/buses/' + busA._id, adminToken, 'PUT', { driver })).status, status);
  }
  await assertLinks(busA, null);
  assert.equal((await profile(driverTokenA)).assignedBus, null);
});

test('legacy fleet references are detected and repeated assignment can repair the matching profile', async () => {
  await Bus.updateOne({ _id: busB._id }, { $set: { driver: driverA._id } });
  assert.equal((await assign(busA, driverA)).status, 409);
  assert.equal((await assign(busB, driverA)).status, 200);
  await assertLinks(busB, driverA);
  assert.equal((await assign(busB, null)).status, 200);
  await User.updateOne({ _id: driverB._id }, { $set: { assignedBus: busA._id } });
  assert.equal((await assign(busA, null)).status, 200);
  assert.equal((await profile(driverTokenB)).assignedBus, null);
});

test('concurrent assignments of one driver to different buses produce one success and one conflict', async () => {
  const results = await Promise.all([assign(busA, driverA), assign(busB, driverA)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const saved = await profile(driverTokenA);
  const winner = saved.assignedBus === busA._id ? busA : busB;
  const other = winner === busA ? busB : busA;
  await assertLinks(winner, driverA);
  await assertLinks(other, null);
  assert.equal((await assign(winner, null)).status, 200);
});

test('concurrent changes of the same bus serialize and leave one matching profile', async () => {
  const results = await Promise.all([assign(busA, driverA), assign(busA, driverB)]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  const saved = (await request('/api/buses/' + busA._id)).data;
  const winner = saved.driver._id === driverA._id ? driverA : driverB;
  const otherToken = winner === driverA ? driverTokenB : driverTokenA;
  await assertLinks(busA, winner);
  assert.equal((await profile(otherToken)).assignedBus, null);
  assert.equal((await assign(busA, null)).status, 200);
});

test('bus creation with a driver synchronizes the profile and failures roll back that assignment', async () => {
  const count = await Bus.countDocuments();
  const duplicate = await request('/api/buses', adminToken, 'POST', { busNumber: busA.busNumber, route: route._id, capacity: 30, driver: driverA._id });
  assert.equal(duplicate.status, 409);
  assert.equal(await Bus.countDocuments(), count);
  assert.equal((await profile(driverTokenA)).assignedBus, null);
  const created = await request('/api/buses', adminToken, 'POST', { busNumber: 'INTEGRATION-C', route: route._id, capacity: 30, driver: driverA._id });
  assert.equal(created.status, 201);
  await assertLinks(created.data, driverA);
  const conflict = await request('/api/buses', adminToken, 'POST', { busNumber: 'INTEGRATION-CONFLICT', route: route._id, capacity: 30, driver: driverA._id });
  assert.equal(conflict.status, 409);
  assert.equal(await Bus.countDocuments(), count + 1);
  assert.equal((await request('/api/buses/' + created.data._id, adminToken, 'DELETE')).status, 200);
  assert.equal((await profile(driverTokenA)).assignedBus, null);
});

test('ordinary bus edits keep their contract and update operators cannot bypass assignment handling', async () => {
  const result = await request('/api/buses/' + busA._id, adminToken, 'PUT', { availableSeats: 35, status: 'maintenance' });
  assert.equal(result.status, 200);
  assert.equal(result.data.availableSeats, 35);
  assert.equal(result.data.status, 'maintenance');
  assert.equal(result.data.driver, null);
  assert.equal((await request('/api/buses/' + busA._id, adminToken, 'PUT', { $set: { driver: driverA._id } })).status, 400);
  await assertLinks(busA, null);
});

test('driver shifts are assigned-bus-only, persistent and safe under concurrent starts', async () => {
  const startEndpoint = '/api/buses/assigned/start-shift';
  assert.equal((await request(startEndpoint, null, 'POST')).status, 401);
  assert.equal((await request(startEndpoint, commuterToken, 'POST')).status, 403);
  assert.equal((await request(startEndpoint, adminToken, 'POST')).status, 403);

  const noBus = await request(startEndpoint, driverTokenA, 'POST');
  assert.equal(noBus.status, 400);
  assert.equal(noBus.data.message, 'No bus assigned.');

  const missingBusId = new mongoose.Types.ObjectId();
  await User.updateOne({ _id: driverB._id }, { $set: { assignedBus: missingBusId } });
  const missingBus = await request(startEndpoint, driverTokenB, 'POST');
  assert.equal(missingBus.status, 404);
  assert.equal(missingBus.data.message, 'Assigned bus not found.');
  await User.updateOne({ _id: driverB._id }, { $set: { assignedBus: null } });

  assert.equal((await assign(busA, driverA)).status, 200);
  const crossBusLocation = await request('/api/buses/' + busB._id + '/location', driverTokenA, 'PATCH', { latitude: 31.4, longitude: 73.08 });
  assert.equal(crossBusLocation.status, 403);
  const beforeShiftLocation = await request('/api/buses/' + busA._id + '/location', driverTokenA, 'PATCH', { latitude: 31.4, longitude: 73.08 });
  assert.equal(beforeShiftLocation.status, 409);

  await User.updateOne({ _id: driverB._id }, { $set: { assignedBus: busA._id } });
  assert.equal((await request(startEndpoint, driverTokenB, 'POST')).status, 403);
  await User.updateOne({ _id: driverB._id }, { $set: { assignedBus: null } });

  await Bus.updateOne({ _id: busA._id }, { $unset: { route: 1 } });
  const noRoute = await request(startEndpoint, driverTokenA, 'POST');
  assert.equal(noRoute.status, 400);
  assert.equal(noRoute.data.message, 'No route assigned.');
  await Bus.updateOne({ _id: busA._id }, { $set: { route: route._id, direction: 'return', currentStopIndex: 4 } });

  const attempts = await Promise.all([
    request(startEndpoint, driverTokenA, 'POST'),
    request(startEndpoint, driverTokenA, 'POST'),
  ]);
  assert.deepEqual(attempts.map((result) => result.status).sort(), [201, 409]);
  const success = attempts.find((result) => result.status === 201).data;
  assert.equal(success.message, 'Shift started successfully');
  assert.equal(success.shift.status, 'active');
  assert.equal(success.shift.startDirection, 'outbound');
  assert.equal(success.shift.bus.status, 'active');
  assert.equal(success.shift.bus.direction, 'outbound');
  assert.equal(success.shift.bus.currentStopIndex, 0);
  assert.equal(String(success.shift.driver._id), driverA._id);
  assert.equal(String(success.shift.route._id), route._id);
  assert.equal(await Shift.countDocuments({ driver: driverA._id, status: 'active' }), 1);

  const refreshedProfile = await profile(driverTokenA);
  assert.equal(refreshedProfile.activeShift.status, 'active');
  assert.equal(String(refreshedProfile.activeShift.bus._id), busA._id);
  const freshIdentity = await login(driverA.email);
  assert.equal((await profile(freshIdentity.token)).activeShift.status, 'active');

  const overview = await request('/api/admin/overview', adminToken);
  assert.equal(overview.status, 200);
  assert.equal(overview.data.activeShifts, 1);
  const adminShifts = await request('/api/admin/shifts', adminToken);
  assert.equal(adminShifts.status, 200);
  assert.equal(adminShifts.data.length, 1);
  assert.equal((await request('/api/admin/shifts', driverTokenA)).status, 403);
});

test('return trip is assigned-driver-only, terminal-gated, atomic and direction-aware', async () => {
  const endpoint = '/api/buses/assigned/return-trip';
  assert.equal((await request(endpoint, null, 'POST')).status, 401);
  assert.equal((await request(endpoint, commuterToken, 'POST')).status, 403);
  const noBus = await request(endpoint, driverTokenB, 'POST');
  assert.equal(noBus.status, 400);
  assert.equal(noBus.data.message, 'No bus assigned.');

  assert.equal((await assign(busA, driverA)).status, 200);
  await User.updateOne({ _id: driverB._id }, { $set: { assignedBus: busA._id } });
  const otherDriver = await request(endpoint, driverTokenB, 'POST');
  assert.equal(otherDriver.status, 403);
  await User.updateOne({ _id: driverB._id }, { $set: { assignedBus: null } });

  await Bus.updateOne({ _id: busA._id }, { $unset: { route: 1 } });
  const noRoute = await request(endpoint, driverTokenA, 'POST');
  assert.equal(noRoute.status, 400);
  assert.equal(noRoute.data.message, 'No route assigned.');
  await Bus.updateOne({ _id: busA._id }, { $set: { route: route._id } });

  const tooShort = await request(endpoint, driverTokenA, 'POST');
  assert.equal(tooShort.status, 400);
  assert.equal(tooShort.data.message, 'Return trip is not available for this route.');

  const secondStop = await Stop.create({ route: route._id, stopName: 'Middle Stop', latitude: 31.43, longitude: 73.09, stopOrder: 2 });
  const terminalStop = await Stop.create({ route: route._id, stopName: 'Outbound Terminal', latitude: 31.44, longitude: 73.1, stopOrder: 3 });
  await Bus.updateOne({ _id: busA._id }, { $set: { direction: 'outbound', currentStopIndex: 1, currentLocation: { latitude: secondStop.latitude, longitude: secondStop.longitude } } });
  const outboundLocation = await request('/api/buses/' + busA._id + '/location', driverTokenA, 'PATCH', {
    latitude: secondStop.latitude,
    longitude: secondStop.longitude,
    speed: 15,
  });
  assert.equal(outboundLocation.status, 200);
  assert.equal(outboundLocation.data.direction, 'outbound');
  assert.equal(outboundLocation.data.currentStop.stopName, secondStop.stopName);
  assert.equal(outboundLocation.data.nextStop.stopName, terminalStop.stopName);
  assert.equal(outboundLocation.data.currentStopIndex, 2);
  const tooEarly = await request(endpoint, driverTokenA, 'POST');
  assert.equal(tooEarly.status, 409);
  assert.equal(tooEarly.data.message, 'Return trip can only start at the terminal.');

  await Bus.updateOne({ _id: busA._id }, { $set: { currentStopIndex: 2, currentLocation: { latitude: terminalStop.latitude, longitude: terminalStop.longitude } } });
  const socket = createSocket(baseUrl, { transports: ['websocket'], reconnection: false, timeout: 5000 });
  try {
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    socket.emit('watchBus', busA._id);
    for (let n = 0; n < 100 && !io.sockets.adapter.rooms.has('bus:' + busA._id); n++) await delay(25);
    const eventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Return direction event not delivered')), 60000);
      socket.once('locationUpdate', (event) => { clearTimeout(timeout); resolve(event); });
    });
    const attempts = await Promise.all([request(endpoint, driverTokenA, 'POST'), request(endpoint, driverTokenA, 'POST')]);
    assert.deepEqual(attempts.map((result) => result.status).sort(), [200, 409]);
    const success = attempts.find((result) => result.status === 200).data;
    assert.equal(success.direction, 'return');
    assert.equal(success.currentStopIndex, 1);
    assert.equal(success.currentStop.stopName, terminalStop.stopName);
    assert.equal(success.nextStop.stopName, secondStop.stopName);
    assert.equal(success.terminalReached, false);
    const event = await eventPromise;
    assert.equal(event.direction, 'return');
    assert.equal(event.nextStop.stopName, secondStop.stopName);
  } finally {
    socket.disconnect();
  }

  const saved = await Bus.findById(busA._id);
  assert.equal(saved.direction, 'return');
  assert.equal(saved.currentStopIndex, 1);
  const eta = await request('/api/buses/' + busA._id + '/eta');
  assert.equal(eta.status, 200);
  assert.equal(eta.data.direction, 'return');
  assert.equal(eta.data.nextStop.stopName, secondStop.stopName);
  const freshIdentity = await login(driverA.email);
  const refreshedBus = await request('/api/buses/' + (await profile(freshIdentity.token)).assignedBus);
  assert.equal(refreshedBus.data.direction, 'return');

  const returnLocation = await request('/api/buses/' + busA._id + '/location', driverTokenA, 'PATCH', { latitude: secondStop.latitude, longitude: secondStop.longitude, speed: 15 });
  assert.equal(returnLocation.status, 200);
  assert.equal(returnLocation.data.direction, 'return');
  assert.equal(returnLocation.data.currentStop.stopName, secondStop.stopName);
  assert.equal(returnLocation.data.nextStop.stopName, 'Integration Stop');
  assert.equal(returnLocation.data.currentStopIndex, 2);
});

test('existing GPS, real Socket.IO delivery, ETA, seats, bookings, routes and analytics work after assignment', async () => {
  assert.equal((await assign(busA, driverA)).status, 200);
  const socket = createSocket(baseUrl, { transports: ['websocket'], reconnection: false, timeout: 5000 });
  try {
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    socket.emit('watchBus', busA._id);
    for (let n = 0; n < 100 && !io.sockets.adapter.rooms.has('bus:' + busA._id); n++) await delay(25);
    assert.ok(io.sockets.adapter.rooms.has('bus:' + busA._id));
    let timeout;
    const update = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Location event not delivered')), 60000);
      socket.once('locationUpdate', (event) => { clearTimeout(timeout); resolve(event); });
    });
    const location = await request('/api/buses/' + busA._id + '/location', driverTokenA, 'PATCH', { latitude: 31.418, longitude: 73.079, speed: 15 });
    assert.equal(location.status, 200);
    const event = await update;
    assert.equal(event.busId, busA._id);
    assert.equal(event.latitude, 31.418);
    assert.equal(location.data.status, 'active');
    assert.ok(location.data.nextStop && location.data.etaMinutes > 0);
    assert.equal((await request('/api/buses/' + busA._id + '/eta')).status, 200);
    assert.equal((await request('/api/buses/' + busA._id + '/seats', driverTokenA, 'PATCH', { availableSeats: 34 })).status, 200);
    assert.equal((await profile(driverTokenA)).assignedBus, busA._id);
    const booking = await request('/api/bookings', commuterToken, 'POST', { bus: busA._id, seatNumber: '1', fare: 10 });
    assert.equal(booking.status, 201);
    assert.equal((await request('/api/bookings/' + booking.data._id + '/cancel', commuterToken, 'PATCH')).status, 200);
    assert.equal((await request('/api/buses/' + busA._id)).data.availableSeats, 34);
    for (const path of ['/api/routes', '/api/routes/' + route._id, '/api/stops/route/' + route._id, '/api/route-alerts/route/' + route._id]) assert.equal((await request(path)).status, 200);
    for (const path of ['/api/admin/overview', '/api/admin/analytics/bookings', '/api/admin/analytics/occupancy', '/api/admin/analytics/reports', '/api/admin/shifts', '/api/reports']) assert.equal((await request(path, adminToken)).status, 200);
    assert.equal((await request('/api/bookings/me', commuterToken)).status, 200);
    assert.equal((await request('/api/safety/sessions/me', commuterToken)).status, 200);
  } finally {
    socket.disconnect();
  }
});

test('route-first and manual bookings resolve only valid active assignments and protect seats/payment state', async () => {
  routeFirstContext = await createRouteFirstFixture();
  const { bus, driver, fixtureId, passengerToken, route: fixtureRoute } = routeFirstContext;
  const seatsBefore = (await Bus.findById(bus._id)).availableSeats;

  const fakePaid = await request('/api/bookings', passengerToken, 'POST', {
    routeId: fixtureRoute._id,
    seatNumber: 'RF-FAKE',
    paymentMethod: 'online',
    paymentStatus: 'paid',
    amount: 1,
  });
  assert.equal(fakePaid.status, 400);

  const created = await request('/api/bookings', passengerToken, 'POST', {
    routeId: fixtureRoute._id,
    seatNumber: 'RF-1',
    paymentMethod: 'online',
    fare: 1,
  });
  assert.equal(created.status, 201, `Route-first booking failed: ${JSON.stringify(created.data)}`);
  routeFirstBooking = created.data;
  assert.equal(routeFirstBooking.route._id, fixtureRoute._id);
  assert.equal(routeFirstBooking.bus._id, bus._id);
  assert.equal(routeFirstBooking.driver._id, driver._id);
  assert.equal(routeFirstBooking.fare, 50);
  assert.equal(routeFirstBooking.currency, 'PKR');
  assert.equal(routeFirstBooking.paymentStatus, 'pending');
  assert.equal((await Bus.findById(bus._id)).availableSeats, seatsBefore - 1);

  const duplicate = await request('/api/bookings', passengerToken, 'POST', {
    routeId: fixtureRoute._id,
    seatNumber: 'RF-OTHER',
  });
  assert.equal(duplicate.status, 409);

  const manualIdentity = await request('/api/auth/register', null, 'POST', {
    name: 'Manual Booking Passenger',
    email: `manual.booking-${fixtureId}@integration.example`,
    password,
  });
  assert.equal(manualIdentity.status, 201);
  const manualToken = manualIdentity.data.token;

  const wrongDriver = await request('/api/bookings', manualToken, 'POST', {
    routeId: fixtureRoute._id,
    bus: bus._id,
    driverId: new mongoose.Types.ObjectId().toString(),
    seatNumber: 'RF-2',
  });
  assert.equal(wrongDriver.status, 400);

  const occupiedSeat = await request('/api/bookings', manualToken, 'POST', {
    routeId: fixtureRoute._id,
    bus: bus._id,
    driverId: driver._id,
    seatNumber: 'RF-1',
  });
  assert.equal(occupiedSeat.status, 409);

  const manual = await request('/api/bookings', manualToken, 'POST', {
    routeId: fixtureRoute._id,
    bus: bus._id,
    driverId: driver._id,
    seatNumber: 'RF-2',
    fare: 0,
  });
  assert.equal(manual.status, 201);
  assert.equal(manual.data.driver._id, driver._id);
  assert.equal(manual.data.fare, 50);
  assert.equal(
    (await request('/api/bookings/' + manual.data._id + '/cancel', manualToken, 'PATCH')).status,
    200
  );
  assert.equal((await Bus.findById(bus._id)).availableSeats, seatsBefore - 1);
});

test('consensual passenger locations reach only the assigned active driver and stop on cancellation', async () => {
  const { bus, driver, driverToken, fixtureId, passengerToken: routeFirstPassengerToken, route: fixtureRoute } = requireRouteFirstContext();
  const otherDriver = await createDriver(`location-driver-${fixtureId}@integration.example`, 'Other Route Driver');
  const otherIdentity = await login(otherDriver.email);
  const otherRouteResponse = await request('/api/routes', adminToken, 'POST', {
    routeName: `Other Location Route ${fixtureId}`,
    startPoint: 'Other Start',
    endPoint: 'Other End',
  });
  assert.equal(otherRouteResponse.status, 201);
  const otherRoute = otherRouteResponse.data;
  assert.equal(
    (
      await request('/api/stops', adminToken, 'POST', {
        route: otherRoute._id,
        stopName: 'Other Stop',
        latitude: 31.5,
        longitude: 73.2,
        stopOrder: 1,
      })
    ).status,
    201
  );
  const otherBusResponse = await request('/api/buses', adminToken, 'POST', {
    busNumber: `LOCATION-OTHER-${fixtureId}`,
    route: otherRoute._id,
    capacity: 20,
    driver: otherDriver._id,
  });
  assert.equal(otherBusResponse.status, 201);
  assert.equal(
    (await request('/api/buses/assigned/start-shift', otherIdentity.token, 'POST')).status,
    201
  );

  const passengerIdentity = await request('/api/auth/register', null, 'POST', {
    name: 'Location Passenger',
    email: `location-passenger-${fixtureId}@integration.example`,
    password,
  });
  assert.equal(passengerIdentity.status, 201);
  const passengerToken = passengerIdentity.data.token;

  const socket = createSocket(baseUrl, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  });
  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    const subscription = await new Promise((resolve) => {
      socket.emit('watchDriverBookings', { token: driverToken }, resolve);
    });
    assert.equal(subscription.ok, true);
    assert.equal(subscription.busId, bus._id);
    assert.ok(io.sockets.adapter.rooms.has('driver:' + driver._id));

    const initialEventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Initial passenger location was not delivered')), 60000);
      socket.once('passengerLocationUpdate', (event) => {
        clearTimeout(timeout);
        resolve(event);
      });
    });
    const booking = await request('/api/bookings', passengerToken, 'POST', {
      routeId: fixtureRoute._id,
      seatNumber: 'LOC-1',
      pickupLocation: {
        latitude: 31.418,
        longitude: 73.079,
        accuracy: 8,
        timestamp: new Date().toISOString(),
      },
      shareLocation: true,
    });
    assert.equal(booking.status, 201);
    const initialEvent = await initialEventPromise;
    assert.equal(initialEvent.bookingId, booking.data._id);
    assert.equal(initialEvent.sharing, true);
    assert.equal(initialEvent.latitude, 31.418);

    const assignedLocations = await request(
      '/api/bookings/assigned/passenger-locations',
      driverToken
    );
    assert.equal(assignedLocations.status, 200);
    assert.equal(
      assignedLocations.data.some((item) => item.bookingId === booking.data._id),
      true
    );
    assert.equal(
      (await request('/api/bookings/assigned/passenger-locations', routeFirstPassengerToken)).status,
      403
    );
    const unrelatedLocations = await request(
      '/api/bookings/assigned/passenger-locations',
      otherIdentity.token
    );
    assert.equal(unrelatedLocations.status, 200);
    assert.deepEqual(unrelatedLocations.data, []);

    const unauthorizedUpdate = await request(
      '/api/bookings/' + booking.data._id + '/location',
      routeFirstPassengerToken,
      'PATCH',
      { shareLocation: false }
    );
    assert.equal(unauthorizedUpdate.status, 403);

    const updateEventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Passenger location update was not delivered')), 60000);
      socket.once('passengerLocationUpdate', (event) => {
        clearTimeout(timeout);
        resolve(event);
      });
    });
    const updated = await request(
      '/api/bookings/' + booking.data._id + '/location',
      passengerToken,
      'PATCH',
      {
        shareLocation: true,
        pickupLocation: {
          latitude: 31.419,
          longitude: 73.08,
          accuracy: 5,
          timestamp: new Date().toISOString(),
        },
      }
    );
    assert.equal(updated.status, 200);
    assert.equal((await updateEventPromise).latitude, 31.419);

    const stoppedEventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Passenger location stop was not delivered')), 60000);
      socket.once('passengerLocationUpdate', (event) => {
        clearTimeout(timeout);
        resolve(event);
      });
    });
    assert.equal(
      (
        await request(
          '/api/bookings/' + booking.data._id + '/cancel',
          passengerToken,
          'PATCH'
        )
      ).status,
      200
    );
    const stoppedEvent = await stoppedEventPromise;
    assert.equal(stoppedEvent.bookingId, booking.data._id);
    assert.equal(stoppedEvent.sharing, false);
    assert.equal(Object.hasOwn(stoppedEvent, 'latitude'), false);

    const locationsAfterCancel = await request(
      '/api/bookings/assigned/passenger-locations',
      driverToken
    );
    assert.equal(locationsAfterCancel.status, 200);
    assert.equal(
      locationsAfterCancel.data.some((item) => item.bookingId === booking.data._id),
      false
    );
    assert.equal((await Booking.findById(booking.data._id)).locationSharingActive, false);
  } finally {
    socket.disconnect();
  }
});

test('signed payment notifications verify success/failure and release failed bookings', async () => {
  const { bus, fixtureId, route: fixtureRoute } = requireRouteFirstContext();
  const successNotification = {
    paymentReference: routeFirstBooking.paymentReference,
    status: 'paid',
    amount: 50,
    currency: 'PKR',
    providerTransactionId: 'provider-success-1',
  };
  const paid = await request(
    '/api/bookings/payments/webhook',
    null,
    'POST',
    successNotification,
    { 'x-payment-signature': paymentSignature(successNotification) }
  );
  assert.equal(paid.status, 200);
  assert.equal(paid.data.booking.paymentStatus, 'paid');
  assert.ok(paid.data.booking.paidAt);

  const failureIdentity = await request('/api/auth/register', null, 'POST', {
    name: 'Failed Payment Passenger',
    email: `failed.payment-${fixtureId}@integration.example`,
    password,
  });
  assert.equal(failureIdentity.status, 201);
  const seatsBefore = (await Bus.findById(bus._id)).availableSeats;
  const pending = await request('/api/bookings', failureIdentity.data.token, 'POST', {
    routeId: fixtureRoute._id,
    seatNumber: 'PAY-FAIL',
    paymentMethod: 'online',
  });
  assert.equal(pending.status, 201);
  assert.equal(pending.data.paymentStatus, 'pending');
  assert.equal((await Bus.findById(bus._id)).availableSeats, seatsBefore - 1);

  const failureNotification = {
    paymentReference: pending.data.paymentReference,
    status: 'failed',
    amount: 50,
    currency: 'PKR',
    providerTransactionId: 'provider-failure-1',
    failureReason: 'Provider declined the payment.',
  };
  const forged = await request(
    '/api/bookings/payments/webhook',
    null,
    'POST',
    failureNotification,
    { 'x-payment-signature': '0'.repeat(64) }
  );
  assert.equal(forged.status, 401);
  assert.equal((await Booking.findById(pending.data._id)).paymentStatus, 'pending');

  const failed = await request(
    '/api/bookings/payments/webhook',
    null,
    'POST',
    failureNotification,
    { 'x-payment-signature': paymentSignature(failureNotification) }
  );
  assert.equal(failed.status, 200);
  assert.equal(failed.data.booking.paymentStatus, 'failed');
  assert.equal(failed.data.booking.status, 'cancelled');
  assert.equal((await Bus.findById(bus._id)).availableSeats, seatsBefore);
});
test('ending a shift is atomic, disables GPS and preserves completed history', async () => {
  const { bus, driver, driverToken, passengerToken } = requireRouteFirstContext();
  const endpoint = '/api/buses/assigned/end-shift';
  assert.equal((await request(endpoint, null, 'POST')).status, 401);
  assert.equal((await request(endpoint, passengerToken, 'POST')).status, 403);
  assert.equal((await request(endpoint, adminToken, 'POST')).status, 403);
  const sharedBeforeEnd = await request(
    '/api/bookings/' + routeFirstBooking._id + '/location',
    passengerToken,
    'PATCH',
    {
      shareLocation: true,
      pickupLocation: {
        latitude: 31.42,
        longitude: 73.082,
        accuracy: 4,
        timestamp: new Date().toISOString(),
      },
    }
  );
  assert.equal(sharedBeforeEnd.status, 200);
  assert.equal(sharedBeforeEnd.data.locationSharingActive, true);

  const socket = createSocket(baseUrl, { transports: ['websocket'], reconnection: false, timeout: 5000 });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  socket.emit('watchBus', bus._id);
  for (let n = 0; n < 100 && !io.sockets.adapter.rooms.has('bus:' + bus._id); n++) await delay(25);
  const driverSubscription = await new Promise((resolve) => {
    socket.emit('watchDriverBookings', { token: driverToken }, resolve);
  });
  assert.equal(driverSubscription.ok, true);
  const accessEnded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Passenger access end event not delivered')), 60000);
    socket.once('passengerLocationAccessEnded', (event) => {
      clearTimeout(timeout);
      resolve(event);
    });
  });
  const statusEvent = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('End-shift status event not delivered')), 60000);
    socket.once('locationUpdate', (event) => { clearTimeout(timeout); resolve(event); });
  });

  const attempts = await Promise.all([
    request(endpoint, driverToken, 'POST'),
    request(endpoint, driverToken, 'POST'),
  ]);
  assert.deepEqual(attempts.map((result) => result.status).sort(), [200, 409]);
  const success = attempts.find((result) => result.status === 200).data;
  assert.equal(success.message, 'Shift ended successfully');
  assert.equal(success.shift.status, 'completed');
  assert.ok(success.shift.endedAt);
  assert.equal(success.shift.bus.status, 'idle');

  const endEvent = await statusEvent;
  assert.equal(endEvent.busId, bus._id);
  assert.equal(endEvent.status, 'idle');
  const accessEndEvent = await accessEnded;
  assert.equal(accessEndEvent.reason, 'shift-ended');
  for (let n = 0; n < 100 && io.sockets.adapter.rooms.has('driver:' + driver._id); n++) await delay(25);
  assert.equal(io.sockets.adapter.rooms.has('driver:' + driver._id), false);

  const savedShift = await Shift.findById(success.shift._id);
  assert.equal(savedShift.status, 'completed');
  assert.ok(savedShift.endedAt);
  assert.equal(await Shift.countDocuments({ driver: driver._id }), 1);
  assert.equal((await Bus.findById(bus._id)).status, 'idle');
  assert.equal((await Booking.findById(routeFirstBooking._id)).locationSharingActive, false);
  assert.equal((await profile(driverToken)).activeShift, null);
  const commuterFleet = await request('/api/buses');
  assert.equal(commuterFleet.status, 200);
  const endedBus = commuterFleet.data.find((item) => item._id === bus._id);
  assert.equal(endedBus.status, 'idle');

  const rejectedLocation = await request('/api/buses/' + bus._id + '/location', driverToken, 'PATCH', { latitude: 31.42, longitude: 73.082 });
  assert.equal(rejectedLocation.status, 409);
  const duplicateEnd = await request(endpoint, driverToken, 'POST');
  assert.equal(duplicateEnd.status, 409);
  assert.equal(duplicateEnd.data.message, 'No active shift found.');

  const adminShifts = await request('/api/admin/shifts', adminToken);
  const completed = adminShifts.data.find((shift) => shift._id === success.shift._id);
  assert.equal(completed.status, 'completed');
  assert.ok(completed.endedAt);
  socket.disconnect();
});

test('driver hard deletion clears fleet links and makes its existing JWT unusable', async () => {
  const driver = await createDriver('delete-driver@integration.example');
  const identity = await login(driver.email);
  assert.equal((await assign(busB, driver)).status, 200);
  const result = await request('/api/admin/drivers/' + driver._id, adminToken, 'DELETE');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { message: 'Driver deleted' });
  await assertLinks(busB, null);
  assert.equal(await User.findById(driver._id), null);
  assert.equal((await request('/api/auth/profile', identity.token)).status, 401);
  assert.equal((await request('/api/admin/drivers/' + commuter._id, adminToken, 'DELETE')).status, 404);
  assert.equal((await request('/api/admin/drivers/invalid', adminToken, 'DELETE')).status, 400);
});

test('bus deletion clears profile assignments', async () => {
  const result = await request('/api/buses/' + busA._id, adminToken, 'DELETE');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { message: 'Bus deleted' });
  assert.equal((await profile(driverTokenA)).assignedBus, null);
  assert.equal(await Bus.findById(busA._id), null);
});

test('concurrent driver deletion and assignment cannot leave an orphan fleet reference', async () => {
  const results = await Promise.all([assign(busB, driverB), request('/api/admin/drivers/' + driverB._id, adminToken, 'DELETE')]);
  assert.ok([200, 404].includes(results[0].status));
  assert.equal(results[1].status, 200);
  await assertLinks(busB, null);
  assert.equal(await User.findById(driverB._id), null);
});

test('concurrent bus deletion and assignment cannot leave a dangling profile assignment', async () => {
  const results = await Promise.all([assign(busB, driverA), request('/api/buses/' + busB._id, adminToken, 'DELETE')]);
  assert.ok([200, 404].includes(results[0].status));
  assert.equal(results[1].status, 200);
  assert.equal(await Bus.findById(busB._id), null);
  assert.equal((await profile(driverTokenA)).assignedBus, null);
});

// Phase 2: exercise new reads through real authorization and MongoDB queries.
test('dashboard sections are admin-only, compact, and honor immediate role revocation', async () => {
  assert.equal((await request('/api/admin/dashboard')).status, 401);
  assert.equal((await request('/api/admin/dashboard', commuterToken)).status, 403);
  assert.equal((await request('/api/admin/dashboard?section=invalid', adminToken)).status, 400);
  const response = await request('/api/admin/dashboard', adminToken);
  assert.equal(response.status, 200);
  const sections = response.data.sections;
  for (const name of ['overview', 'bookings', 'reports', 'buses', 'routes', 'stops', 'occupancy']) assert.equal(sections[name].status, 'ready', name);
  assert.deepEqual(sections.overview.data, (await request('/api/admin/overview', adminToken)).data);
  assert.deepEqual(sections.bookings.data, (await request('/api/admin/analytics/bookings', adminToken)).data);
  assert.ok(sections.buses.data.every((bus) => !Object.hasOwn(bus, 'seatMap') && !Object.hasOwn(bus, 'recentSpeeds')));
  assert.ok(sections.routes.data.every((route) => !Object.hasOwn(route, 'geometry')));
  assert.ok(sections.reports.data.reports.length <= 20);
  assert.ok(sections.reports.data.reports.every((report) => !report.user || !Object.hasOwn(report.user, 'email')));
  const adminId = require('jsonwebtoken').verify(adminToken, process.env.JWT_SECRET).id;
  try {
    await User.findByIdAndUpdate(adminId, { role: 'commuter' });
    assert.equal((await request('/api/admin/dashboard', adminToken)).status, 403);
  } finally { await User.findByIdAndUpdate(adminId, { role: 'admin' }); }
});

test('grouped stops preserve physical identity, route ordering and legacy compatibility', async () => {
  assert.equal((await request('/api/stops/grouped')).status, 401);
  assert.equal((await request('/api/stops/grouped', commuterToken)).status, 403);
  const RouteStop = require('../src/models/RouteStop');
  const first = await Route.create({ routeName: 'Batch first', startPoint: 'A', endPoint: 'B' });
  const second = await Route.create({ routeName: 'Batch second', startPoint: 'B', endPoint: 'C' });
  const shared = await Stop.create({ stopName: 'Shared batch stop', latitude: 31.4, longitude: 73.1, route: first._id, stopOrder: 2 });
  const legacy = await Stop.create({ stopName: 'Legacy batch stop', latitude: 31.41, longitude: 73.11, route: first._id, stopOrder: 1 });
  await RouteStop.create([{ route: first._id, stop: shared._id, stopOrder: 2 }, { route: second._id, stop: shared._id, stopOrder: 1 }]);
  const before = await Stop.countDocuments();
  const response = await request('/api/stops/grouped', adminToken);
  assert.equal(response.status, 200);
  const one = response.data.find((group) => group.route._id === String(first._id));
  const two = response.data.find((group) => group.route._id === String(second._id));
  assert.deepEqual(one.stops.map((stop) => stop._id), [String(legacy._id), String(shared._id)]);
  assert.deepEqual(two.stops.map((stop) => stop._id), [String(shared._id)]);
  assert.equal(await Stop.countDocuments(), before);
  const detail = await request('/api/stops/route/' + first._id);
  assert.deepEqual(one.stops.map((stop) => [stop._id, stop.stopOrder]), detail.data.map((stop) => [stop._id, stop.stopOrder]));
});

test('aggregated notifications require authentication and exclude expired/inactive-route alerts', async () => {
  const active = await Route.create({ routeName: 'Notification active', startPoint: 'A', endPoint: 'B' });
  const inactive = await Route.create({ routeName: 'Notification inactive', startPoint: 'A', endPoint: 'B', isActive: false });
  const persistent = await RouteAlert.create({ route: active._id, message: 'Persistent' });
  const current = await RouteAlert.create({ route: active._id, message: 'Current', expiresAt: new Date(Date.now() + 600000) });
  const expired = await RouteAlert.create({ route: active._id, message: 'Expired', expiresAt: new Date(Date.now() - 600000) });
  const hidden = await RouteAlert.create({ route: inactive._id, message: 'Inactive route' });
  assert.equal((await request('/api/route-alerts/active')).status, 401);
  const response = await request('/api/route-alerts/active', commuterToken);
  assert.equal(response.status, 200);
  const ids = response.data.map((alert) => alert._id);
  assert.ok(ids.includes(String(persistent._id)) && ids.includes(String(current._id)));
  assert.ok(!ids.includes(String(expired._id)) && !ids.includes(String(hidden._id)));
  assert.equal(response.data.find((alert) => alert._id === String(current._id)).routeName, active.routeName);
  assert.equal((await request('/api/route-alerts/route/' + active._id)).status, 200);
});
