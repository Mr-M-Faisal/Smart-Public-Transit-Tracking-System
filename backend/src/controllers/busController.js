const Bus = require('../models/Bus');
const Shift = require('../models/Shift');
const { getStopsForRoute } = require('../services/routeStopService');
const { publicBus, emitSeatUpdate, changeManualSeat } = require('../services/seatService');
const { sendApiError: sendSeatError, ApiError } = require('../utils/apiError');
const { createFleetBus, updateFleetBus, deleteFleetBus } = require('../services/busAssignmentService');
const { sendApiError } = require('../utils/apiError');
const { haversineDistanceKm } = require('../utils/geo');

// How close (in km) the bus must get to a stop before we consider it
// "reached" and advance to the next one. ~50 meters.
const ARRIVAL_THRESHOLD_KM = 0.05;

// A sensible fallback speed (km/h) to use for ETA when we don't have
// any real speed readings yet (e.g. right after a bus starts its shift).
const DEFAULT_SPEED_KMH = 20;

const getBusDirection = (bus) => bus.direction === 'return' ? 'return' : 'outbound';

const getStopsInDirection = (stops, direction) => direction === 'return' ? [...stops].reverse() : stops;

const stopSummary = (stop) => stop ? { _id: stop._id, stopName: stop.stopName, stopOrder: stop.stopOrder } : null;

const sameId = (left, right) => left && right && left.toString() === right.toString();

// Works out the next stop for a bus and the ETA to it, in minutes.
// This is the core of the ETA Estimation Module from the proposal:
// - finds the next stop in sequence past currentStopIndex
// - measures straight-line distance from the bus's current location
// - divides by a 5-reading moving average of recent speeds
const calculateNextStopAndETA = async (bus) => {
  const storedStops = await getStopsForRoute(bus.route);
  const direction = getBusDirection(bus);
  const stops = getStopsInDirection(storedStops, direction);

  if (stops.length === 0 || bus.currentLocation.latitude == null) {
    return { direction, currentStop: null, nextStop: null, distanceKm: null, etaMinutes: null, terminalReached: false };
  }

  let nextStop = stops[bus.currentStopIndex] || null;
  let currentStop = bus.currentStopIndex > 0 ? stops[bus.currentStopIndex - 1] : null;
  let terminalReached = false;

  // If the bus is already within range of its current target stop,
  // advance to the one after it (this is what "detects arrival" means).
  if (nextStop) {
    const distToCurrentTarget = haversineDistanceKm(
      bus.currentLocation.latitude,
      bus.currentLocation.longitude,
      nextStop.latitude,
      nextStop.longitude
    );

    if (distToCurrentTarget <= ARRIVAL_THRESHOLD_KM && bus.currentStopIndex < stops.length - 1) {
      currentStop = nextStop;
      bus.currentStopIndex += 1;
      nextStop = stops[bus.currentStopIndex];
    } else if (distToCurrentTarget <= ARRIVAL_THRESHOLD_KM && bus.currentStopIndex === stops.length - 1) {
      currentStop = nextStop;
      terminalReached = true;
    }
  }

  if (!nextStop) {
    // Bus has passed the last stop on the route
    return { direction, currentStop: stopSummary(currentStop), nextStop: null, distanceKm: 0, etaMinutes: 0, terminalReached };
  }

  const distanceKm = haversineDistanceKm(
    bus.currentLocation.latitude,
    bus.currentLocation.longitude,
    nextStop.latitude,
    nextStop.longitude
  );

  const avgSpeed =
    bus.recentSpeeds.length > 0
      ? bus.recentSpeeds.reduce((sum, s) => sum + s, 0) / bus.recentSpeeds.length
      : DEFAULT_SPEED_KMH;

  const etaMinutes = avgSpeed > 0 ? (distanceKm / avgSpeed) * 60 : null;

  return {
    direction,
    currentStop: stopSummary(currentStop),
    nextStop: stopSummary(nextStop),
    distanceKm: Math.round(distanceKm * 100) / 100,
    etaMinutes: etaMinutes != null ? Math.round(etaMinutes * 10) / 10 : null,
    terminalReached,
  };
};

// @route   POST /api/buses/assigned/return-trip
// @desc    Start the authenticated driver's return trip at the outbound terminal
// @access  Private (driver)
const startReturnTrip = async (req, res) => {
  try {
    if (!req.user.assignedBus) return res.status(400).json({ message: 'No bus assigned.' });

    const bus = await Bus.findById(req.user.assignedBus);
    if (!bus) return res.status(404).json({ message: 'Assigned bus not found.' });
    if (!sameId(bus.driver, req.user._id)) return res.status(403).json({ message: 'Forbidden: this bus is not assigned to you.' });
    if (!bus.route) return res.status(400).json({ message: 'No route assigned.' });
    if (!await Shift.exists({ driver: req.user._id, bus: bus._id, status: 'active' })) {
      return res.status(409).json({ message: 'Start an active shift before starting a return trip.' });
    }
    if (getBusDirection(bus) === 'return') return res.status(409).json({ message: 'Return trip has already started.' });

    const stops = await getStopsForRoute(bus.route);
    if (stops.length < 2) return res.status(400).json({ message: 'Return trip is not available for this route.' });

    const terminal = stops[stops.length - 1];
    const atTerminal = bus.currentLocation.latitude != null && bus.currentLocation.longitude != null &&
      bus.currentStopIndex === stops.length - 1 &&
      haversineDistanceKm(bus.currentLocation.latitude, bus.currentLocation.longitude, terminal.latitude, terminal.longitude) <= ARRIVAL_THRESHOLD_KM;
    if (!atTerminal) return res.status(409).json({ message: 'Return trip can only start at the terminal.' });

    const updated = await Bus.findOneAndUpdate(
      { _id: bus._id, driver: req.user._id, direction: { $ne: 'return' }, currentStopIndex: stops.length - 1 },
      { $set: { direction: 'return', currentStopIndex: 0 } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ message: 'Return trip has already started.' });

    const etaInfo = await calculateNextStopAndETA(updated);
    await updated.save();
    const payload = {
      busId: updated._id,
      latitude: updated.currentLocation.latitude,
      longitude: updated.currentLocation.longitude,
      lastLocationUpdate: updated.lastLocationUpdate,
      status: updated.status,
      ...etaInfo,
    };
    req.app.get('io').to(`bus:${updated._id}`).emit('locationUpdate', payload);
    res.status(200).json({ ...updated.toObject(), ...etaInfo });
  } catch (err) {
    res.status(500).json({ message: 'Server error starting return trip', error: err.message });
  }
};

// @route   POST /api/buses
const createBus = async (req, res) => {
  try {
    const bus = await createFleetBus(req.body);
    res.status(201).json(publicBus(bus));
  } catch (error) {
    sendApiError(res, error, 'Server error creating bus', 'A bus with this bus number already exists.');
  }
};

// @route   GET /api/buses
const getBuses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.route) filter.route = req.query.route;

    const buses = await Bus.find(filter)
      .select('-seatMap -recentSpeeds')
      .populate('route', 'routeName')
      .populate('driver', 'name phone').lean();

    res.status(200).json(buses);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching buses', error: err.message });
  }
};

// @route   GET /api/buses/:id
const getBusById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate('route', 'routeName')
      .populate('driver', 'name phone');

    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }
    res.status(200).json(publicBus(bus));
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching bus', error: err.message });
  }
};

// @route   GET /api/buses/:id/eta
// @desc    Get this bus's next stop and estimated time of arrival
// @access  Public
const getBusETA = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    const result = await calculateNextStopAndETA(bus);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error calculating ETA', error: err.message });
  }
};

// @route   PATCH /api/buses/:id/location
// @desc    Update a bus's live GPS location (called by the driver app).
//          Optionally accepts `speed` in km/h, as sent by the HTML5
//          Geolocation API on the driver's device.
// @access  Private (driver)
const updateBusLocation = async (req, res) => {
  try {
    const { latitude, longitude, speed } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ message: 'latitude and longitude are required' });
    }

    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }
    if (!sameId(req.user.assignedBus, bus._id) || !sameId(bus.driver, req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: this bus is not assigned to you.' });
    }
    if (!await Shift.exists({ driver: req.user._id, bus: bus._id, status: 'active' })) {
      return res.status(409).json({ message: 'Start an active shift before updating location.' });
    }

    bus.currentLocation = { latitude, longitude };
    bus.lastLocationUpdate = new Date();
    bus.status = 'active';

    // Maintain a rolling window of the last 5 speed readings
    if (speed != null && !Number.isNaN(speed)) {
      bus.recentSpeeds.push(speed);
      if (bus.recentSpeeds.length > 5) {
        bus.recentSpeeds.shift(); // drop the oldest reading
      }
    }

    // This also advances bus.currentStopIndex if the bus has arrived
    const etaInfo = await calculateNextStopAndETA(bus);

    await bus.save();

    // Broadcast this update (now including ETA) to anyone watching this bus
    const io = req.app.get('io');
    io.to(`bus:${bus._id}`).emit('locationUpdate', {
      busId: bus._id,
      latitude,
      longitude,
      lastLocationUpdate: bus.lastLocationUpdate,
      status: bus.status,
      ...etaInfo,
    });

    res.status(200).json({ ...bus.toObject(), ...etaInfo });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating bus location', error: err.message });
  }
};

// @route   PATCH /api/buses/:id/seats
const updateSeatAvailability = async (req, res) => {
  try {
    const { availableSeats } = req.body || {};
    if (!Number.isInteger(availableSeats)) throw new ApiError(400, 'availableSeats must be a whole number.');
    const bus = await Bus.findById(req.params.id);
    if (!bus) throw new ApiError(404, 'Bus not found.');
    if (bus.seatMap?.length) throw new ApiError(409, 'Configured buses must be managed seat by seat.');
    if (req.user.role === 'driver') {
      if (!sameId(req.user.assignedBus, bus._id) || !sameId(bus.driver, req.user._id)) throw new ApiError(403, 'This bus is not assigned to you.');
      if (!await Shift.exists({ driver: req.user._id, bus: bus._id, route: bus.route, status: 'active' })) throw new ApiError(409, 'Start an active shift before updating seats.');
    }
    if (availableSeats < 0 || availableSeats > bus.capacity) throw new ApiError(400, 'Available seats must be within capacity.');
    bus.availableSeats = availableSeats;
    await bus.save();
    emitSeatUpdate(req.app.get('io'), bus);
    res.status(200).json(publicBus(bus));
  } catch (error) { sendSeatError(res, error, 'Server error updating seat availability'); }
};

const updateIndividualSeat = async (req, res) => {
  try {
    if (Object.keys(req.body || {}).some((key) => key !== 'action')) throw new ApiError(400, 'Only action can be provided.');
    const bus = await changeManualSeat(req.params.id, req.user._id, req.params.label, req.body?.action);
    emitSeatUpdate(req.app.get('io'), bus);
    res.status(200).json(publicBus(bus));
  } catch (error) { sendSeatError(res, error, 'Server error updating seat'); }
};
// @route   PUT /api/buses/:id
const updateBus = async (req, res) => {
  try {
    const bus = await updateFleetBus(req.params.id, req.body);
    emitSeatUpdate(req.app.get('io'), bus);
    res.status(200).json(publicBus(bus));
  } catch (error) {
    sendApiError(res, error, 'Server error updating bus', 'A bus with this bus number already exists.');
  }
};

// @route   DELETE /api/buses/:id
const deleteBus = async (req, res) => {
  try {
    await deleteFleetBus(req.params.id);
    res.status(200).json({ message: 'Bus deleted' });
  } catch (error) {
    sendApiError(res, error, 'Server error deleting bus');
  }
};

module.exports = {
  createBus,
  getBuses,
  getBusById,
  getBusETA,
  updateBusLocation,
  startReturnTrip,
  updateSeatAvailability,
  updateIndividualSeat,
  updateBus,
  deleteBus,
};


