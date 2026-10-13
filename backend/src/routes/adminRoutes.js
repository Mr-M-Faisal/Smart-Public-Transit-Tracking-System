const express = require('express');
const router = express.Router();
const {
  getFleetOverview,
  getBookingsAnalytics,
  getOccupancyByRoute,
  getReportsSummary,
  getShifts,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { getDrivers, createDriver, updateDriver, deleteDriver } = require('../controllers/adminDriverController');

// Every route here is admin-only — this whole file is the dashboard's data layer
router.use(protect, authorize('admin'));

router.get('/dashboard', require('../controllers/dashboardController').getDashboard);
router.get('/overview', getFleetOverview);
router.get('/analytics/bookings', getBookingsAnalytics);
router.get('/analytics/occupancy', getOccupancyByRoute);
router.get('/analytics/reports', getReportsSummary);
router.get('/shifts', getShifts);

router.get('/drivers', getDrivers);
router.post('/drivers', createDriver);
router.put('/drivers/:id', updateDriver);
router.delete('/drivers/:id', deleteDriver);

module.exports = router;
