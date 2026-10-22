import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * Roles used across the platform.
 *
 * - `buyer`  — default for any new sign-up.
 * - `seller` — granted when the user completes the BecomeSeller flow.
 * - `admin`  — back-office staff. Granted only by another admin (or the
 *   seeded super-admin on first boot).
 */
export const ROLES = ['buyer', 'seller', 'admin'];

const verificationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    isStudent: Boolean,
    university: String,
    occupation: String,
    businessReg: String,
    /**
     * Data URL (base64) of an uploaded student-ID card. Stored inline
     * for v1 — when we move to S3, this becomes a key/url pair. It's
     * only set when isStudent === true and review is pending.
     */
    idCardUrl: String,
    idCardUploadedAt: Date,
  },
  { _id: false }
);

const sellerProfileSchema = new mongoose.Schema(
  {
    storeName: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 2000 },
    location: { type: String, trim: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const payoutSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['mtn-momo', 'vodafone-cash', 'airteltigo-money', 'bank'],
      default: 'mtn-momo',
    },
    account: { type: String, trim: true, maxlength: 30 },
    accountName: { type: String, trim: true, maxlength: 80 },
    network: { type: String, trim: true, maxlength: 40 },
    updatedAt: Date,
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    plan: { type: String, default: 'free' }, // matches Plan.code
    status: {
      type: String,
      enum: ['active', 'canceled', 'expired'],
      default: 'active',
    },
    startedAt: Date,
    renewsAt: Date,   // end of the paid period; the plan lapses to Free after it
    lastRef: String,  // last Paystack reference applied, so a payment counts once
  },
  { _id: false }
);

const cardSchema = new mongoose.Schema(
  {
    brand: String,        // 'Visa', 'Mastercard', 'MoMo', etc.
    last4: String,        // last 4 digits or last 4 of MoMo number
    holder: String,
    expiry: String,       // 'MM/YY' (mock — not stored in real PCI flow)
    method: { type: String, enum: ['card', 'momo'], default: 'card' },
  },
  { _id: true, timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, maxlength: 80 },
    email:    {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      match: [/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Invalid email'],
    },
    // Hash, not the password. `select: false` means it never comes back
    // from a plain `User.find` — we have to ask for it explicitly with
    // `.select('+passwordHash')`. Defence-in-depth.
    passwordHash: { type: String, select: false },
    googleId:     { type: String, sparse: true, index: true },

    role:    { type: String, enum: ROLES, default: 'buyer', index: true },
    avatar:  String,
    phone:   String,
    location:{ type: String, trim: true },

    // Account state — controlled exclusively by admins.
    restricted:    { type: Boolean, default: false, index: true },
    restrictReason:String,
    restrictedAt:  Date,
    restrictedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    verified:      { type: Boolean, default: false, index: true },
    verification:  { type: verificationSchema, default: () => ({}) },

    sellerProfile: sellerProfileSchema,
    payout: payoutSchema,
    subscription:  { type: subscriptionSchema, default: () => ({ plan: 'free', status: 'active' }) },
    onboardingFeePaid: { type: Boolean, default: false },
    onboardingPaidAt:  Date,
    onboardingRef:     String,

    // Saved payment methods (mock). The real implementation would
    // tokenise these via a PSP — we never store full PANs.
    paymentMethods: [cardSchema],

    lastLoginAt: Date,

    resetPasswordTokenHash: { type: String, select: false },
    resetPasswordExpiresAt: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hide sensitive fields from any JSON serialisation (e.g. res.json(user)).
userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.resetPasswordTokenHash;
  delete obj.resetPasswordExpiresAt;
  delete obj.__v;
  return obj;
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
};

export const User = mongoose.model('User', userSchema);
