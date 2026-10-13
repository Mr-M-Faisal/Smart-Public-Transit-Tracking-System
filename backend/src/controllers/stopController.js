const mongoose = require('mongoose');
const Stop = require('../models/Stop');
const Route = require('../models/Route');
const RouteStop = require('../models/RouteStop');
const {
  cleanText,
  findOrCreatePhysicalStop,
  getStopsForRoute,
  getStopsForRoutes,
  publicRouteStop,
  stopIdentity,
} = require('../services/routeStopService');
const { queueRouteGeometryRefresh } = require('../services/routeGeometryService');

function validCoordinates(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number(latitude) >= -90 && Number(latitude) <= 90 &&
    Number.isFinite(Number(longitude)) && Number(longitude) >= -180 && Number(longitude) <= 180;
}

function validOrder(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

async function populatedAssignment(id) {
  return RouteStop.findById(id).populate('stop');
}

// @route   POST /api/stops
const createStop = async (req, res) => {
  try {
    const { route, stopName, latitude, longitude, stopOrder, location = '' } = req.body;
    if (!mongoose.isValidObjectId(route) || !cleanText(stopName) || !validCoordinates(latitude, longitude) || !validOrder(stopOrder)) {
      return res.status(400).json({ message: 'A valid route, stop name, coordinates, and stop order are required.' });
    }

    const stop = await findOrCreatePhysicalStop({ stopName, latitude, longitude, location });
    if (await RouteStop.exists({ route, stop: stop._id })) {
      return res.status(409).json({ message: 'This physical stop is already assigned to the selected route.' });
    }
    const assignment = await RouteStop.create({ route, stop: stop._id, stopOrder: Number(stopOrder) });
    queueRouteGeometryRefresh(route);
    res.status(201).json(publicRouteStop(await populatedAssignment(assignment._id)));
  } catch (err) {
    res.status(500).json({ message: 'Server error creating stop', error: err.message });
  }
};

// @route   GET /api/stops/route/:routeId
const getStopsByRoute = async (req, res) => {
  try {
    res.status(200).json(await getStopsForRoute(req.params.routeId));
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching stops', error: err.message });
  }
};

// @route   GET /api/stops/:id
const getStopById = async (req, res) => {
  try {
    const stop = await Stop.findById(req.params.id);
    if (!stop) return res.status(404).json({ message: 'Stop not found' });
    const assignments = await RouteStop.find({ stop: stop._id }).sort({ stopOrder: 1 }).populate('route', 'routeName');
    res.status(200).json({ ...stop.toObject(), routes: assignments.map((item) => ({ route: item.route, stopOrder: item.stopOrder, routeStopId: item._id })) });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching stop', error: err.message });
  }
};

// @route   PUT /api/stops/:id
const updateStop = async (req, res) => {
  try {
    const { route, originalRoute, routeStopId, stopName, latitude, longitude, stopOrder, location = '' } = req.body;
    if (!mongoose.isValidObjectId(route) || !cleanText(stopName) || !validCoordinates(latitude, longitude) || !validOrder(stopOrder)) {
      return res.status(400).json({ message: 'A valid route, stop name, coordinates, and stop order are required.' });
    }
    const currentStop = await Stop.findById(req.params.id);
    if (!currentStop) return res.status(404).json({ message: 'Stop not found' });

    const assignmentFilter = mongoose.isValidObjectId(routeStopId)
      ? { _id: routeStopId, stop: currentStop._id }
      : { stop: currentStop._id, route: originalRoute || route };
    let assignment = await RouteStop.findOne(assignmentFilter);

    // Upgrade a legacy record the first time it is edited.
    if (!assignment && currentStop.route) {
      assignment = await RouteStop.findOneAndUpdate(
        { route: currentStop.route, stop: currentStop._id },
        { $setOnInsert: { stopOrder: currentStop.stopOrder } },
        { upsert: true, new: true }
      );
    }
    if (!assignment) return res.status(404).json({ message: 'Route stop assignment not found' });

    const values = { stopName: cleanText(stopName), latitude: Number(latitude), longitude: Number(longitude), location: cleanText(location) };
    const identityKey = stopIdentity(values);
    const matchingStop = await Stop.findOne({ identityKey });
    const targetStop = matchingStop || currentStop;
    if (!matchingStop) Object.assign(currentStop, values, { identityKey });

    const duplicateAssignment = await RouteStop.findOne({ route, stop: targetStop._id, _id: { $ne: assignment._id } });
    if (duplicateAssignment) return res.status(409).json({ message: 'This physical stop is already assigned to the selected route.' });

    if (!matchingStop) await currentStop.save();
    assignment.route = route;
    assignment.stop = targetStop._id;
    assignment.stopOrder = Number(stopOrder);
    await assignment.save();

    if (!targetStop._id.equals(currentStop._id) && !await RouteStop.exists({ stop: currentStop._id })) {
      await Stop.deleteOne({ _id: currentStop._id });
    }
    queueRouteGeometryRefresh(assignment.route);
    if (originalRoute && String(originalRoute) !== String(assignment.route)) queueRouteGeometryRefresh(originalRoute);
    res.status(200).json(publicRouteStop(await populatedAssignment(assignment._id)));
  } catch (err) {
    res.status(500).json({ message: 'Server error updating stop', error: err.message });
  }
};

// @route   DELETE /api/stops/:id
const deleteStop = async (req, res) => {
  try {
    const filter = mongoose.isValidObjectId(req.query.routeStopId)
      ? { _id: req.query.routeStopId, stop: req.params.id }
      : { stop: req.params.id, route: req.query.route };
    if (!filter._id && !mongoose.isValidObjectId(filter.route)) {
      return res.status(400).json({ message: 'route or routeStopId is required to remove a route stop.' });
    }
    const assignment = await RouteStop.findOneAndDelete(filter);
    if (!assignment) return res.status(404).json({ message: 'Route stop assignment not found' });

    const stillUsed = await RouteStop.exists({ stop: req.params.id });
    if (!stillUsed) await Stop.deleteOne({ _id: req.params.id });
    queueRouteGeometryRefresh(assignment.route);
    res.status(200).json({ message: 'Stop removed from route', physicalStopDeleted: !stillUsed });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting stop', error: err.message });
  }
};

async function getGroupedStops(req, res) {
  res.set('Cache-Control', 'private, no-store');
  try {
    const routes = await Route.find({ isActive: true }).select('routeName startPoint endPoint').sort({ createdAt: -1 }).lean();
    const stops = await getStopsForRoutes(routes.map((route) => route._id));
    const grouped = new Map(routes.map((route) => [String(route._id), { route, stops: [] }]));
    for (const stop of stops) grouped.get(String(stop.route))?.stops.push(stop);
    res.json([...grouped.values()]);
  } catch { res.status(500).json({ message: 'Unable to load route stops.' }); }
}

module.exports = { getGroupedStops, createStop, getStopsByRoute, getStopById, updateStop, deleteStop };
