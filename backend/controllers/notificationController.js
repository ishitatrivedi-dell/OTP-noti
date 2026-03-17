const Notification = require('../models/Notification');

async function listNotifications(req, res) {
  const userId = String(req.query.userId || '').trim();
  if (!userId) return res.status(400).json({ message: 'userId is required' });

  const limit = Math.min(Number(req.query.limit || 50), 200);
  const notifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ notifications });
}

module.exports = { listNotifications };

