const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    routeName: { type: String, required: true, trim: true },
    startPoint: { type: String, required: true },
    endPoint: { type: String, required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    // Road-network coordinates are generated from the ordered RouteStop records.
    // They are deliberately stored with the route so public map views never have
    // to call a routing provider for every visitor.
    geometry: {
      outbound: { type: [[Number]], default: [] },
      return: { type: [[Number]], default: [] },
    },
    geometryStatus: { type: String, enum: ['pending', 'ready', 'unavailable'], default: 'unavailable' },
    geometryUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Active route catalogue ordered newest first.
routeSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Route', routeSchema);
