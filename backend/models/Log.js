const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null, index: true },
    action: { type: String, required: true, index: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    meta: { type: Object, default: null },
  },
  { timestamps: false }
);

module.exports = mongoose.model('Log', logSchema);

