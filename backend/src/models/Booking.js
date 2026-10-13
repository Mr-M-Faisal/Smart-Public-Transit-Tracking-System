const crypto = require('crypto');
const mongoose = require('mongoose');

const pickupLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, min: -90, max: 90, required: true },
    longitude: { type: Number, min: -180, max: 180, required: true },
    accuracy: { type: Number, min: 0, default: null },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    // Nullable for records created before route-first booking. New bookings set both.
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    seatNumber: { type: String, default: null, trim: true },
    // A client-generated key makes an interrupted/retried booking request
    // idempotent for its owner. It is never a ticket or payment reference.
    idempotencyKey: { type: String, trim: true, default: null },
    status: { type: String, enum: ['confirmed', 'cancelled', 'completed'], default: 'confirmed' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: { type: String, enum: ['cash', 'online'], default: 'cash' },
    paymentReference: {
      type: String,
      unique: true,
      sparse: true,
      default: () => crypto.randomBytes(16).toString('hex'),
    },
    providerTransactionId: { type: String, unique: true, sparse: true },
    paymentProvider: { type: String, default: null },
    paymentFailureReason: { type: String, default: null },
    paidAt: { type: Date, default: null },
    fare: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'PKR' },
    pickupLocation: { type: pickupLocationSchema, default: null },
    locationSharingActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bookingSchema.pre('save', function stopLocationForInactiveBooking(next) {
  if (this.status !== 'confirmed') {
    this.locationSharingActive = false;
  }
  next();
});

// Dashboard counts and date-range booking analytics have no user filter.
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ bus: 1, status: 1, seatNumber: 1 });
bookingSchema.index({ route: 1, status: 1 });
bookingSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Booking', bookingSchema);
