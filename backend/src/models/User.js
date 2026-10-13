const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Google-only commuters do not have a local password. All existing and
    // administrator-created accounts retain the same password requirement.
    password: { type: String, required: function () { return !this.googleId; }, minlength: 6 },
    phone: { type: String, trim: true },
    profileImage: { type: String, default: null },
    googleId: { type: String, unique: true, sparse: true, default: undefined },
    role: { type: String, enum: ['commuter', 'driver', 'admin'], default: 'commuter' },
    assignedBus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return Boolean(this.password) && bcrypt.compare(enteredPassword, this.password);
};

// Driver directory filters by role and orders by name/id.
userSchema.index({ role: 1, name: 1, _id: 1 });

module.exports = mongoose.model('User', userSchema);
