const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    reportType: { type: String, enum: ['condition', 'safety'], required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['open', 'reviewed', 'resolved'], default: 'open' },
  },
  { timestamps: true }
);

// Report lists sort newest first, optionally filtered by status.
reportSchema.index({ createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
