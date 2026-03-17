const Log = require('../models/Log');

async function listLogs(req, res) {
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const action = req.query.action ? String(req.query.action) : null;

  const filter = {};
  if (action) filter.action = action;

  const logs = await Log.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
  res.json({ logs });
}

async function dailyActivity(req, res) {
  const days = Math.min(Number(req.query.days || 7), 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const buckets = await Log.aggregate([
    { $match: { timestamp: { $gte: since } } },
    {
      $group: {
        _id: {
          y: { $year: '$timestamp' },
          m: { $month: '$timestamp' },
          d: { $dayOfMonth: '$timestamp' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
  ]);

  const activity = buckets.map((b) => ({
    date: `${b._id.y}-${String(b._id.m).padStart(2, '0')}-${String(b._id.d).padStart(2, '0')}`,
    count: b.count,
  }));

  res.json({ since, days, activity });
}

module.exports = { listLogs, dailyActivity };

