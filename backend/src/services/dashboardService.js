const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Booking = require('../models/Booking');
const Report = require('../models/Report');
const Shift = require('../models/Shift');
const { getStopsForRoutes } = require('./routeStopService');

async function overviewData() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [statuses, totalRoutes, bookingsToday, openReports, activeShifts] = await Promise.all([
    Bus.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Route.countDocuments({ isActive: true }),
    Booking.countDocuments({ createdAt: { $gte: startOfToday } }),
    Report.countDocuments({ status: 'open' }),
    Shift.countDocuments({ status: 'active' }),
  ]);
  const buses = { total: 0, active: 0, idle: 0, maintenance: 0 };
  for (const item of statuses) { buses.total += item.count; if (Object.hasOwn(buses, item._id)) buses[item._id] = item.count; }
  return { buses, routes: { total: totalRoutes }, bookingsToday, openReports, activeShifts };
}

async function bookingAnalyticsData() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // include today = 7 days total
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const results = await Booking.aggregate([
      // Stage 1: only look at bookings from the last 7 days
      { $match: { createdAt: { $gte: sevenDaysAgo } } },

      // Stage 2: group bookings by their calendar day
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$fare' },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },

      // Stage 3: sort oldest to newest so it plots left-to-right on a chart
      { $sort: { _id: 1 } },
    ]);

    return results;
}

async function reportDashboardData() {
  const [result] = await Report.aggregate([{ $facet: {
    byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
    byType: [{ $group: { _id: '$reportType', count: { $sum: 1 } } }],
    recent: [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 20 },
      { $project: { user: 1, bus: 1, reportType: 1, description: 1, status: 1, createdAt: 1 } }],
  } }]);
  const reports = await Report.populate(result.recent, [{ path: 'user', select: 'name' }, { path: 'bus', select: 'busNumber' }]);
  return { reports, summary: { byStatus: result.byStatus, byType: result.byType } };
}

async function sectionResult(read) {
  try { return { status: 'ready', data: await read() }; }
  catch { return { status: 'error', message: 'This dashboard section is unavailable. Please retry.' }; }
}

async function dashboardData(section = 'all') {
  const tasks = {};
  if (section === 'all' || section === 'overview') tasks.overview = sectionResult(overviewData);
  if (section === 'all' || section === 'analytics') {
    tasks.bookings = sectionResult(bookingAnalyticsData);
    tasks.reports = sectionResult(reportDashboardData);
  }
  if (section === 'all' || section === 'transit') {
    // Share reads between fleet, occupancy, routes and batched stops in this request.
    const buses = Bus.find({}).select('busNumber driver route capacity availableSeats currentLocation lastLocationUpdate status direction').populate('route', 'routeName').populate('driver', 'name').lean().exec();
    const routes = Route.find({ isActive: true }).select('routeName startPoint endPoint').sort({ createdAt: -1 }).lean().exec();
    tasks.buses = sectionResult(() => buses);
    tasks.routes = sectionResult(() => routes);
    tasks.stops = sectionResult(async () => getStopsForRoutes((await routes).map((route) => route._id)));
    tasks.occupancy = sectionResult(async () => {
      const groups = new Map();
      for (const bus of await buses) {
        if (!bus.route?._id) continue;
        const id = String(bus.route._id);
        const group = groups.get(id) || { routeId: id, routeName: bus.route.routeName, busCount: 0, total: 0 };
        group.busCount += 1;
        group.total += bus.capacity > 0 ? (bus.capacity - bus.availableSeats) / bus.capacity * 100 : 0;
        groups.set(id, group);
      }
      return [...groups.values()].map(({ total, ...group }) => ({ ...group, averageOccupancy: Math.round(total / group.busCount * 10) / 10 }));
    });
  }
  const entries = await Promise.all(Object.entries(tasks).map(async ([key, result]) => [key, await result]));
  return Object.fromEntries(entries);
}
module.exports = { dashboardData, overviewData, bookingAnalyticsData };
