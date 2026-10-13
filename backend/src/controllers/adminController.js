const { overviewData, bookingAnalyticsData } = require('../services/dashboardService');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Booking = require('../models/Booking');
const Report = require('../models/Report');
const Shift = require('../models/Shift');

// @route   GET /api/admin/overview
// @desc    High-level fleet snapshot for the dashboard home screen
// @access  Private (admin)
const getFleetOverview = async (req, res) => {
  try {
    res.status(200).json(await overviewData());
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching fleet overview', error: err.message });
  }
};

// @route   GET /api/admin/analytics/bookings
// @desc    Bookings per day for the last 7 days
// @access  Private (admin)
const getBookingsAnalytics = async (req, res) => {
  try {
    res.status(200).json(await bookingAnalyticsData());
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching booking analytics', error: err.message });
  }
};

// @route   GET /api/admin/analytics/occupancy
// @desc    Average seat occupancy (%) per route, across all buses on it
// @access  Private (admin)
const getOccupancyByRoute = async (req, res) => {
  try {
    const results = await Bus.aggregate([
      // Stage 1: work out this bus's occupancy percentage
      {
        $project: {
          route: 1,
          busNumber: 1,
          occupancyPercent: {
            $multiply: [
              { $divide: [{ $subtract: ['$capacity', '$availableSeats'] }, '$capacity'] },
              100,
            ],
          },
        },
      },
      // Stage 2: group all buses by route, average their occupancy
      {
        $group: {
          _id: '$route',
          averageOccupancy: { $avg: '$occupancyPercent' },
          busCount: { $sum: 1 },
        },
      },
      // Stage 3: pull in the route's name instead of just its ID
      {
        $lookup: {
          from: 'routes',
          localField: '_id',
          foreignField: '_id',
          as: 'routeInfo',
        },
      },
      { $unwind: '$routeInfo' },
      {
        $project: {
          _id: 0,
          routeId: '$_id',
          routeName: '$routeInfo.routeName',
          busCount: 1,
          averageOccupancy: { $round: ['$averageOccupancy', 1] },
        },
      },
    ]);

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching occupancy analytics', error: err.message });
  }
};

// @route   GET /api/admin/analytics/reports
// @desc    Report counts grouped by status and type
// @access  Private (admin)
const getReportsSummary = async (req, res) => {
  try {
    const byStatus = await Report.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byType = await Report.aggregate([
      { $group: { _id: '$reportType', count: { $sum: 1 } } },
    ]);

    res.status(200).json({ byStatus, byType });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching reports summary', error: err.message });
  }
};

const getShifts = async (req, res) => {
  try {
    const shifts = await Shift.find({})
      .populate('driver', 'name email phone')
      .populate('bus', 'busNumber status direction')
      .populate('route', 'routeName startPoint endPoint')
      .sort({ startedAt: -1 });
    res.status(200).json(shifts);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching shifts' });
  }
};

module.exports = {
  getFleetOverview,
  getBookingsAnalytics,
  getOccupancyByRoute,
  getReportsSummary,
  getShifts,
};
