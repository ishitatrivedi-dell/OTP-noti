const Log = require('../models/Log');

/**
 * Central logger:
 * - persists to Mongo (Log collection)
 * - emits to all clients over Socket.io ("log-update")
 */
async function createLog({ io, userId = null, action, message, meta = null }) {
  const doc = await Log.create({
    userId: userId ? String(userId) : null,
    action,
    message,
    timestamp: new Date(),
    meta,
  });

  if (io) {
    io.emit('log-update', {
      _id: doc._id,
      userId: doc.userId,
      action: doc.action,
      message: doc.message,
      timestamp: doc.timestamp,
      meta: doc.meta,
    });
  }

  return doc;
}

function makeLogger({ io }) {
  return {
    info: (action, message, opts = {}) =>
      createLog({ io, action, message, userId: opts.userId ?? null, meta: opts.meta ?? null }),
  };
}

module.exports = { createLog, makeLogger };

