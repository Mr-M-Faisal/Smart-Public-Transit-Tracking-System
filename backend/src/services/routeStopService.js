const Stop = require('../models/Stop');
const RouteStop = require('../models/RouteStop');

const cleanText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizedText = (value) => cleanText(value).toLocaleLowerCase('en');
const coordinatePart = (value) => Number(value).toFixed(6);

function stopIdentity({ stopName, latitude, longitude, location = '' }) {
  return [normalizedText(stopName), coordinatePart(latitude), coordinatePart(longitude), normalizedText(location)].join('|');
}

function publicRouteStop(assignment) {
  const stop = assignment.stop?.toObject ? assignment.stop.toObject() : assignment.stop;
  if (!stop) return null;
  return { ...stop, route: assignment.route?._id || assignment.route, stopOrder: assignment.stopOrder, routeStopId: assignment._id };
}

async function getStopsForRoute(routeId, { session } = {}) {
  const query = RouteStop.find({ route: routeId }).sort({ stopOrder: 1, createdAt: 1 }).populate('stop');
  if (session) query.session(session);
  const assignments = await query;
  const result = assignments.map(publicRouteStop).filter(Boolean);
  // Supports unmigrated records and direct legacy writes during a rolling deployment.
  const legacyQuery = Stop.find({ route: routeId }).select('+route +stopOrder');
  if (session) legacyQuery.session(session);
  const legacy = await legacyQuery.sort({ stopOrder: 1 });
  const linkedIds = new Set(result.map((stop) => String(stop._id)));
  for (const stop of legacy) {
    if (!linkedIds.has(String(stop._id))) result.push({ ...stop.toObject(), route: routeId, stopOrder: stop.stopOrder });
  }
  return result.sort((left, right) => left.stopOrder - right.stopOrder);
}

async function routeHasStops(routeId, { session } = {}) {
  const assignmentQuery = RouteStop.exists({ route: routeId });
  if (session) assignmentQuery.session(session);
  if (await assignmentQuery) return true;
  const legacyQuery = Stop.exists({ route: routeId });
  if (session) legacyQuery.session(session);
  return Boolean(await legacyQuery);
}

async function findOrCreatePhysicalStop(data, { session } = {}) {
  const values = { stopName: cleanText(data.stopName), latitude: Number(data.latitude), longitude: Number(data.longitude), location: cleanText(data.location) };
  const identityKey = stopIdentity(values);
  let stop = await Stop.findOne({ identityKey }).session(session || null);
  if (!stop) {
    try {
      [stop] = await Stop.create([{ ...values, identityKey }], { session });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      stop = await Stop.findOne({ identityKey }).session(session || null);
    }
  }
  return stop;
}

// Batch the same physical-stop/assignment merge used by route details. Read only.
async function getStopsForRoutes(routeIds) {
  if (!routeIds.length) return [];
  const [assignments, legacy] = await Promise.all([
    RouteStop.find({ route: { $in: routeIds } }).sort({ stopOrder: 1, createdAt: 1 }).populate('stop').lean(),
    Stop.find({ route: { $in: routeIds } }).select('+route +stopOrder').sort({ stopOrder: 1 }).lean(),
  ]);
  const result = assignments.map(publicRouteStop).filter(Boolean);
  const linked = new Set(result.map((stop) => String(stop.route) + ':' + String(stop._id)));
  for (const stop of legacy) {
    const key = String(stop.route) + ':' + String(stop._id);
    if (!linked.has(key)) { result.push(stop); linked.add(key); }
  }
  return result.sort((a, b) => String(a.route).localeCompare(String(b.route)) || a.stopOrder - b.stopOrder);
}

module.exports = { getStopsForRoutes, cleanText, stopIdentity, publicRouteStop, getStopsForRoute, routeHasStops, findOrCreatePhysicalStop };
