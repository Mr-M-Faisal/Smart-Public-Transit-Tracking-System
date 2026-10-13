const { dashboardData } = require('../services/dashboardService');
async function getDashboard(req, res) {
  const section = req.query.section || 'all';
  if (!['all', 'overview', 'analytics', 'transit'].includes(section)) return res.status(400).json({ message: 'Invalid dashboard section.' });
  res.set('Cache-Control', 'private, no-store');
  try { res.json({ sections: await dashboardData(section) }); }
  catch { res.status(500).json({ message: 'Unable to load dashboard.' }); }
}
module.exports = { getDashboard };
